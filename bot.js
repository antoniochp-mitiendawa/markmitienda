const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const readline = require("readline");
const initSqlJs = require('sql.js');
const axios = require('axios');
const { exec } = require('child_process');

exec('termux-wake-lock', (e) => { if (!e) console.log("\x1b[32m[ WAKE ] Activado\x1b[0m"); });

const DB_PATH = './grupospro.sqlite';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const cuestion = (t) => new Promise((r) => rl.question(t, r));

const HORA_INICIO = 9;
const HORA_FIN = 22;
const MINUTOS_CICLO = 260;
const SEGUNDOS_CICLO = MINUTOS_CICLO * 60;

let botActivo = true;

async function subirGrupos(sock, url) {
    try {
        const grupos = await sock.groupFetchAllParticipating();
        const lista = Object.entries(grupos).map(([id, info]) => ({ id: id, nombre: info.subject }));
        await axios.get(`${url}?action=upload&grupos=${JSON.stringify(lista)}`);
        console.log(`\x1b[32m[ UPLOAD ] Subidos ${lista.length} grupos\x1b[0m`);
    } catch (e) { console.log(`\x1b[31m[ UPLOAD ERROR ] ${e.message}\x1b[0m`); }
}

async function ejecutarCiclo(sock, db, carpetaRuta, jidPersonal, cicloNum, gruposLista, productosLista) {
    if (!botActivo) return;
    const cantidad = gruposLista.length;
    const delayBaseMs = (SEGUNDOS_CICLO / cantidad) * 1000;
    console.log(`\x1b[35m[CICLO ${cicloNum}] Inicio | Grupos: ${cantidad} | Delay base: ${(delayBaseMs/1000).toFixed(0)}s\x1b[0m`);
    
    const r = (a) => a[Math.floor(Math.random() * a.length)];
    const getSaludo = () => { const h = new Date().getHours(); if (h >= 6 && h < 12) return "¡BUENOS DIAS!"; if (h >= 12 && h < 19) return "¡BUENAS TARDES!"; return "¡BUENAS NOCHES!"; };
    const intro = ["HOLA, COLABORADORES DE", "ESTIMADOS AMIGOS DE", "QUÉ TAL, GRUPO", "SALUDOS CORDIALES A"];
    const llamado = ["SOLICITA EL TUYO POR PRIVADO", "RESERVA EL TUYO AHORA", "APROVECHA ESTA OFERTA"];
    const emoPromo = ["🔥", "⭐", "📢", "💎"];
    const emoCall = ["👇", "📩", "✅", "⚡"];
    
    for (const [gid, gnom] of gruposLista) {
        if (!botActivo) break;
        const prod = r(productosLista);
        const [item, desc, precio] = prod;
        const delayFinal = Math.min(Math.max(delayBaseMs * (0.6 + Math.random() * 0.8), 7000), 25000);
        const msgText = `${r(emoPromo)} *EXCELENTE OPORTUNIDAD* ${r(emoPromo)}\n> *${r(intro)} ${gnom.toUpperCase()}*\n   _*${getSaludo()}*_\n\n✅ *${item.toUpperCase()}*\n📝 ${desc}\n💰 *PRECIO ESPECIAL:* $${precio} MXN\n\n${r(emoCall)} *${r(llamado).toUpperCase()}*`;
        
        console.log(`\x1b[36m[CICLO ${cicloNum}] ${gnom} (${(delayFinal/1000).toFixed(0)}s)\x1b[0m`);
        await sock.sendPresenceUpdate('composing', gid);
        await delay(3000);
        await sock.sendPresenceUpdate('paused', gid);
        
        const buscarImg = (prod) => { if (!fs.existsSync(carpetaRuta)) return null; const arch = fs.readdirSync(carpetaRuta); const base = prod.toLowerCase(); return arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.jpg') || f.endsWith('.png'))); };
        const img = buscarImg(item);
        if (img) await sock.sendMessage(gid, { image: { url: carpetaRuta + img }, caption: msgText });
        else await sock.sendMessage(gid, { text: msgText });
        
        await sock.sendMessage(jidPersonal, { text: `[CICLO ${cicloNum}] ${gnom}\n${item}` });
        await delay(delayFinal);
    }
    console.log(`\x1b[32m[CICLO ${cicloNum}] Completado\x1b[0m`);
}

async function iniciarCiclos(sock, db, carpetaRuta, urlSheets) {
    const ahora = new Date();
    const horaActual = ahora.getHours();
    
    if (horaActual >= HORA_INICIO && horaActual < HORA_FIN && botActivo) {
        const grupos = db.exec("SELECT id, nombre FROM grupos");
        const productos = db.exec("SELECT item, descripcion, precio FROM productos");
        if (grupos[0] && productos[0]) {
            const jidPersonal = sock.user.id.split(":")[0] + "@s.whatsapp.net";
            const listaG = grupos[0].values;
            const listaP = productos[0].values;
            
            await ejecutarCiclo(sock, db, carpetaRuta, jidPersonal, 1, listaG, listaP);
            if (!botActivo) return;
            setTimeout(async () => {
                if (!botActivo) return;
                const g2 = db.exec("SELECT id, nombre FROM grupos");
                const p2 = db.exec("SELECT item, descripcion, precio FROM productos");
                if (g2[0] && p2[0]) await ejecutarCiclo(sock, db, carpetaRuta, jidPersonal, 2, g2[0].values, p2[0].values);
            }, MINUTOS_CICLO * 60 * 1000);
            setTimeout(async () => {
                if (!botActivo) return;
                const g3 = db.exec("SELECT id, nombre FROM grupos");
                const p3 = db.exec("SELECT item, descripcion, precio FROM productos");
                if (g3[0] && p3[0]) await ejecutarCiclo(sock, db, carpetaRuta, jidPersonal, 3, g3[0].values, p3[0].values);
            }, MINUTOS_CICLO * 120 * 1000);
        }
    } else if (botActivo) {
        const manana = new Date();
        manana.setHours(HORA_INICIO, 0, 0, 0);
        if (manana <= ahora) manana.setDate(manana.getDate() + 1);
        const ms = manana - ahora;
        console.log(`\x1b[33m[SCHED] Proximo inicio en ${Math.floor(ms/3600000)}h${Math.floor((ms%3600000)/60000)}m\x1b[0m`);
        setTimeout(() => iniciarCiclos(sock, db, carpetaRuta, urlSheets), ms);
    }
}

async function sincronizar() {
    console.log("\x1b[33m[ SYNC ] Conectando con Google Sheets...\x1b[0m");
    const SQL = await initSqlJs();
    let db = new SQL.Database();
    db.run("CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS productos (item TEXT, descripcion TEXT, precio TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS grupos (id TEXT, nombre TEXT)");
    const url = await cuestion("\x1b[33m[ CONFIG ] Pega tu URL de Google Sheets: \x1b[0m");
    try {
        const res = await axios.get(url);
        if (res.data.status === "success") {
            db.run("INSERT OR REPLACE INTO ajustes VALUES ('url_sheets',?)", [url]);
            res.data.productos.forEach(p => db.run("INSERT INTO productos VALUES (?,?,?)", [p.item, p.descripcion || "Sin descripcion", p.precio]));
            res.data.grupos.forEach(g => db.run("INSERT INTO grupos VALUES (?,?)", [g.id, g.nombre]));
            fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
            console.log(`\x1b[32m[ SYNC ] OK | Productos: ${res.data.productos.length} | Grupos: ${res.data.grupos.length}\x1b[0m`);
            return true;
        }
    } catch (e) { console.log("\x1b[31m[ SYNC ERROR ]\x1b[0m", e.message); return false; }
    return false;
}

async function iniciar() {
    console.log("\x1b[34m[ MARKMITIENDA ] Bot de WhatsApp\x1b[0m");
    
    if (!fs.existsSync(DB_PATH)) {
        console.log("\x1b[33m[ AVISO ] No hay base de datos. Sincronizando...\x1b[0m");
        if (!await sincronizar()) return console.log("\x1b[31m[ ERROR ] Sincronizacion fallida\x1b[0m");
    }
    
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log("\x1b[32m[ OK ] Base de datos cargada\x1b[0m");

    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: state, printQRInTerminal: false, logger: pino({ level: "silent" }), browser: ["Ubuntu", "Chrome", "20.0.0"] });

    let vinculacionCompletada = false;

    if (!sock.authState.creds.registered && !vinculacionCompletada) {
        console.log("\x1b[33m[ INFO ] Vinculacion...\x1b[0m");
        await delay(3000);
        const num = await cuestion("\x1b[33m[ CONFIG ] Tu numero (ej: 521XXXXXXXXXX): \x1b[0m");
        try {
            const codigo = await sock.requestPairingCode(num.trim());
            console.log("\x1b[32m\nCODIGO: " + codigo + "\n\x1b[0m");
            vinculacionCompletada = true;
        } catch (e) { console.log("\x1b[31m[ ERROR ] " + e.message + "\x1b[0m"); }
    }

    sock.ev.on("creds.update", saveCreds);
    
    let conexionEstablecida = false;
    
    sock.ev.on("connection.update", async (u) => {
        if (u.connection === "open" && !conexionEstablecida) {
            conexionEstablecida = true;
            console.log("\x1b[32m[ OK ] WhatsApp conectado\x1b[0m");
            console.log("\x1b[36m[ AVISO ] Escribe 'prueba' para test\x1b[0m");
            const urlRes = db.exec("SELECT valor FROM ajustes WHERE clave = 'url_sheets'");
            if (urlRes[0]) {
                await subirGrupos(sock, urlRes[0].values[0][0]);
                iniciarCiclos(sock, db, "/sdcard/DCIM/", urlRes[0].values[0][0]);
            }
        } else if (u.connection === "close") {
            console.log("\x1b[31m[ LOG ] Conexion cerrada. Esperando 5s...\x1b[0m");
            conexionEstablecida = false;
            await delay(5000);
            if (botActivo) iniciar();
        }
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
        if (txt === "prueba") {
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
