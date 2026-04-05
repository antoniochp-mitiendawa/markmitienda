const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const readline = require("readline");
const initSqlJs = require('sql.js');

const DB_PATH = './grupospro.sqlite';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const cuestion = (t) => new Promise((r) => rl.question(t, r));

async function iniciar() {
    console.log("\x1b[34m[ MARKMITIENDA ] Bot de WhatsApp\x1b[0m");
    
    let db;
    if (fs.existsSync(DB_PATH)) {
        const SQL = await initSqlJs();
        const buf = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buf);
        console.log("\x1b[32m[ OK ] Base de datos cargada\x1b[0m");
    } else {
        console.log("\x1b[33m[ AVISO ] No hay base de datos. Ejecuta sync.js primero\x1b[0m");
    }

    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: state, printQRInTerminal: false, logger: pino({ level: "silent" }), browser: ["Ubuntu", "Chrome", "20.0.0"] });

    if (!sock.authState.creds.registered) {
        console.log("\x1b[33m[ INFO ] Vinculacion...\x1b[0m");
        await delay(3000);
        const num = await cuestion("\x1b[33m[ CONFIG ] Tu numero (ej: 521XXXXXXXXXX): \x1b[0m");
        const codigo = await sock.requestPairingCode(num.trim());
        console.log("\x1b[32m\nCODIGO: " + codigo + "\n\x1b[0m");
    }

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (u) => {
        if (u.connection === "open") console.log("\x1b[32m[ OK ] WhatsApp conectado\x1b[0m\n\x1b[36m[ AVISO ] Escribe 'prueba' en tu chat\x1b[0m");
        else if (u.connection === "close") iniciar();
    });

    const r = (a) => a[Math.floor(Math.random() * a.length)];
    const getSaludo = () => { const h = new Date().getHours(); if (h >= 6 && h < 12) return "¡BUENOS DIAS!"; if (h >= 12 && h < 19) return "¡BUENAS TARDES!"; return "¡BUENAS NOCHES!"; };
    const intro = ["HOLA, COLABORADORES DE", "ESTIMADOS AMIGOS DE", "QUÉ TAL, GRUPO", "SALUDOS CORDIALES A"];
    const llamado = ["SOLICITA EL TUYO POR PRIVADO", "RESERVA EL TUYO AHORA", "APROVECHA ESTA OFERTA"];
    const emoPromo = ["🔥", "⭐", "📢", "💎"];
    const emoCall = ["👇", "📩", "✅", "⚡"];

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe === false) return;
        const txt = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        if (txt === "prueba" && db) {
            console.log("\x1b[35m[ TEST ] Iniciando...\x1b[0m");
            const grupos = db.exec("SELECT id, nombre FROM grupos");
            const prods = db.exec("SELECT item, descripcion, precio FROM productos");
            if (!grupos[0] || !prods[0]) return console.log("\x1b[31m[ ERROR ] No hay datos\x1b[0m");
            const listaG = grupos[0].values;
            const listaP = prods[0].values;
            let carpeta = "/sdcard/DCIM/";
            if (!fs.existsSync(carpeta)) carpeta = "/sdcard/" + (await cuestion("\x1b[33m[CARPETA] Nombre: \x1b[0m")) + "/";
            const buscarImg = (prod) => { if (!fs.existsSync(carpeta)) return null; const arch = fs.readdirSync(carpeta); const base = prod.toLowerCase(); return arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.jpg') || f.endsWith('.png'))); };
            for (const [gid, gnom] of listaG) {
                const prod = r(listaP);
                const [item, desc, precio] = prod;
                const delayMsg = Math.floor(Math.random() * (25000 - 7000 + 1) + 7000);
                const msgText = `${r(emoPromo)} *EXCELENTE OPORTUNIDAD* ${r(emoPromo)}\n> *${r(intro)} ${gnom.toUpperCase()}*\n   _*${getSaludo()}*_\n\n✅ *${item.toUpperCase()}*\n📝 ${desc}\n💰 *PRECIO ESPECIAL:* $${precio} MXN\n\n${r(emoCall)} *${r(llamado).toUpperCase()}*`;
                console.log(`\x1b[36m[ TEST ] ${gnom} (${(delayMsg/1000).toFixed(0)}s)\x1b[0m`);
                await sock.sendPresenceUpdate('composing', gid);
                await delay(3000);
                await sock.sendPresenceUpdate('paused', gid);
                const img = buscarImg(item);
                if (img) await sock.sendMessage(gid, { image: { url: carpeta + img }, caption: msgText });
                else await sock.sendMessage(gid, { text: msgText });
                await sock.sendMessage(msg.key.remoteJid, { text: `[TEST] ${gnom}\n${item}` });
                await delay(delayMsg);
            }
            console.log("\x1b[32m[ TEST ] Completado\x1b[0m");
        }
    });
}
iniciar();
