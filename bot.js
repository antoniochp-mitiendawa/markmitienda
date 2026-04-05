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

let emojiDB = {};
let sinonimosDB = {};

try { emojiDB = require('./emojis.js'); } catch(e) { console.log("\x1b[33m[ AVISO ] emojis.js no encontrado\x1b[0m"); }
try { sinonimosDB = require('./sinonimos.js'); } catch(e) { console.log("\x1b[33m[ AVISO ] sinonimos.js no encontrado\x1b[0m"); }

const HORA_SYNC = 8;
const HORA_INICIO = 9;
const HORA_FIN = 22;
const MINUTOS_CICLO = 260;
const SEGUNDOS_CICLO = MINUTOS_CICLO * 60;

let botActivo = true;
let conexionEstablecida = false;
let carpetaMultimedia = "";
let urlSheets = "";

const r = (arr) => { if (!arr || arr.length === 0) return ""; return arr[Math.floor(Math.random() * arr.length)]; };

function getSaludoPorHora() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return r(sinonimosDB.saludos?.manana || ["¡buenos dias!"]);
    if (h >= 12 && h < 19) return r(sinonimosDB.saludos?.tarde || ["¡buenas tardes!"]);
    return r(sinonimosDB.saludos?.noche || ["¡buenas noches!"]);
}

function getEmojiProducto(producto) {
    const p = producto.toLowerCase();
    if (p.includes("playera")) return r(emojiDB.productos?.playera || ["👕"]);
    if (p.includes("gorra")) return r(emojiDB.productos?.gorra || ["🧢"]);
    if (p.includes("vaso") || p.includes("termico")) return r(emojiDB.productos?.vaso || ["🥤"]);
    return r(emojiDB.productos?.default || ["🎁"]);
}

function getGancho() {
    const opciones = [
        { texto: "EXCELENTE OPORTUNIDAD", emoji: r(emojiDB.promo || ["🔥", "⭐", "📢"]) },
        { texto: "MIRA ESTE PRODUCTO", emoji: r(emojiDB.promo || ["🔥", "⭐", "📢"]) },
        { texto: "OFERTA ESPECIAL", emoji: r(emojiDB.promo || ["🔥", "⭐", "📢"]) },
        { texto: "TE PUEDE INTERESAR", emoji: r(emojiDB.promo || ["🔥", "⭐", "📢"]) },
        { texto: "MIRA ESTO", emoji: r(emojiDB.promo || ["🔥", "⭐", "📢"]) }
    ];
    const g = r(opciones);
    const emoji2 = r(emojiDB.promo || ["🔥", "⭐", "📢"]);
    return { texto: g.texto, emoji1: g.emoji, emoji2: emoji2 };
}

function getIntro() {
    return r(sinonimosDB.intro || ["hola, colaboradores de"]);
}

function getLlamado() {
    return { emoji: r(emojiDB.llamado || ["👇", "📩", "✅"]), texto: r(sinonimosDB.llamado || ["solicita el tuyo por privado"]) };
}

function generarMensaje(nombreGrupo, producto, descripcion, precio, plantilla) {
    const gancho = getGancho();
    const intro = getIntro();
    const saludoEmoji = r(emojiDB.saludos || ["👋", "🙌", "✨"]);
    const saludoHora = getSaludoPorHora();
    const emojiProducto = getEmojiProducto(producto);
    const llamado = getLlamado();
    const productoUpper = producto.charAt(0).toUpperCase() + producto.slice(1).toLowerCase();
    const nombreGrupoLower = nombreGrupo.toLowerCase();
    
    const tieneDescripcion = descripcion && descripcion !== "Sin descripcion" && descripcion !== "";
    
    let msg = "";
    
    if (plantilla === 1) {
        msg = `${gancho.emoji} *${gancho.texto}* ${gancho.emoji2}\n————————————————————\n> *${intro} ${nombreGrupoLower}*\n   _*${saludoHora}*_ ${saludoEmoji}\n————————————————————\n✅ *${productoUpper}* ${emojiProducto}`;
        if (tieneDescripcion) msg += `\n📝 ${descripcion}`;
        msg += `\n💰 *precio:* $${precio} mxn\n————————————————————\n${llamado.emoji} *${llamado.texto}*`;
    } else if (plantilla === 2) {
        msg = `${gancho.emoji} *${gancho.texto}* ${gancho.emoji2}\n> *${intro} ${nombreGrupoLower}*\n   _*${saludoHora}*_ ${saludoEmoji}\n\n✅ *${productoUpper}* ${emojiProducto}`;
        if (tieneDescripcion) msg += `\n📝 ${descripcion}`;
        msg += `\n💰 *precio:* $${precio} mxn\n\n${llamado.emoji} *${llamado.texto}*`;
    } else {
        msg = `${gancho.emoji} *${gancho.texto}* ${gancho.emoji2}\n> *${intro} ${nombreGrupoLower}*\n   _*${saludoHora}*_ ${saludoEmoji}\n\n✅ *${productoUpper}* ${emojiProducto}`;
        if (tieneDescripcion) msg += `\n📝 ${descripcion}`;
        msg += `\n💰 *precio:* $${precio} mxn\n\n${llamado.emoji} *${llamado.texto}*`;
    }
    
    return msg;
}

async function subirGrupos(sock, url) {
    try {
        const grupos = await sock.groupFetchAllParticipating();
        const lista = Object.entries(grupos).map(([id, info]) => ({ id: id, nombre: info.subject }));
        for (const g of lista) {
            await axios.get(`${url}?action=reporte&id=${encodeURIComponent(g.id)}&nombre=${encodeURIComponent(g.nombre)}`);
            await delay(100);
        }
        console.log(`\x1b[32m[ UPLOAD ] Subidos ${lista.length} grupos\x1b[0m`);
    } catch (e) { console.log(`\x1b[31m[ UPLOAD ERROR ] ${e.message}\x1b[0m`); }
}

async function sincronizarDescarga(url) {
    try {
        const res = await axios.get(url);
        if (res.data.status === "success") {
            const SQL = await initSqlJs();
            let db = new SQL.Database();
            db.run("CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT)");
            db.run("CREATE TABLE IF NOT EXISTS productos (item TEXT, descripcion TEXT, precio TEXT)");
            db.run("CREATE TABLE IF NOT EXISTS grupos (id TEXT, nombre TEXT)");
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

async function ejecutarCiclo(sock, db, jidPersonal, cicloNum, gruposLista, productosLista) {
    if (!botActivo) return;
    const cantidad = gruposLista.length;
    const delayBaseMs = (SEGUNDOS_CICLO / cantidad) * 1000;
    console.log(`\x1b[35m[ciclo ${cicloNum}] inicio | grupos: ${cantidad}\x1b[0m`);
    
    const productosEnviadosEnCiclo = new Set();
    
    for (const [gid, gnom] of gruposLista) {
        if (!botActivo) break;
        
        let productosDisponibles = productosLista.filter(p => !productosEnviadosEnCiclo.has(p[0]));
        if (productosDisponibles.length === 0) {
            productosEnviadosEnCiclo.clear();
            productosDisponibles = productosLista;
        }
        
        const prod = r(productosDisponibles);
        const [item, desc, precio] = prod;
        productosEnviadosEnCiclo.add(item);
        
        const delayFinal = Math.min(Math.max(delayBaseMs * (0.6 + Math.random() * 0.8), 7000), 25000);
        const plantilla = Math.floor(Math.random() * 3) + 1;
        const contenido = generarMensaje(gnom, item, desc, precio, plantilla);
        
        console.log(`\x1b[36m[ciclo ${cicloNum}] ${gnom} (${(delayFinal/1000).toFixed(0)}s) plantilla ${plantilla}\x1b[0m`);
        
        await sock.sendPresenceUpdate('composing', gid);
        await delay(6000);
        await sock.sendPresenceUpdate('paused', gid);
        
        const archivos = [];
        if (fs.existsSync(carpetaMultimedia)) {
            const arch = fs.readdirSync(carpetaMultimedia);
            const base = item.toLowerCase();
            const imagen = arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')));
            const video = arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.mp4') || f.endsWith('.webm')));
            const documento = arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.pdf') || f.endsWith('.docx')));
            if (imagen) archivos.push({ type: 'image', file: imagen });
            if (video) archivos.push({ type: 'video', file: video });
            if (documento) archivos.push({ type: 'document', file: documento });
        }
        
        if (archivos.length > 0) {
            for (const arch of archivos) {
                if (arch.type === 'image') await sock.sendMessage(gid, { image: { url: carpetaMultimedia + arch.file }, caption: contenido });
                else if (arch.type === 'video') await sock.sendMessage(gid, { video: { url: carpetaMultimedia + arch.file }, caption: contenido });
                else await sock.sendMessage(gid, { document: { url: carpetaMultimedia + arch.file }, caption: contenido });
                await delay(2000);
            }
        } else {
            await sock.sendMessage(gid, { text: contenido });
        }
        
        await sock.sendMessage(jidPersonal, { text: `[ciclo ${cicloNum}] ${gnom}\n${item}` });
        await delay(delayFinal);
    }
    console.log(`\x1b[32m[ciclo ${cicloNum}] completado\x1b[0m`);
}

async function iniciarCiclos(sock, db, jidPersonal) {
    const ahora = new Date();
    const horaActual = ahora.getHours();
    
    if (horaActual >= HORA_INICIO && horaActual < HORA_FIN && botActivo) {
        const grupos = db.exec("SELECT id, nombre FROM grupos");
        const productos = db.exec("SELECT item, descripcion, precio FROM productos");
        if (grupos[0] && productos[0]) {
            const listaG = grupos[0].values;
            const listaP = productos[0].values;
            
            await ejecutarCiclo(sock, db, jidPersonal, 1, listaG, listaP);
            if (!botActivo) return;
            setTimeout(async () => {
                if (!botActivo) return;
                const g2 = db.exec("SELECT id, nombre FROM grupos");
                const p2 = db.exec("SELECT item, descripcion, precio FROM productos");
                if (g2[0] && p2[0]) await ejecutarCiclo(sock, db, jidPersonal, 2, g2[0].values, p2[0].values);
            }, MINUTOS_CICLO * 60 * 1000);
            setTimeout(async () => {
                if (!botActivo) return;
                const g3 = db.exec("SELECT id, nombre FROM grupos");
                const p3 = db.exec("SELECT item, descripcion, precio FROM productos");
                if (g3[0] && p3[0]) await ejecutarCiclo(sock, db, jidPersonal, 3, g3[0].values, p3[0].values);
            }, MINUTOS_CICLO * 120 * 60 * 1000);
        }
    } else if (botActivo) {
        const proximo = new Date();
        proximo.setHours(HORA_INICIO, 0, 0, 0);
        if (proximo <= ahora) proximo.setDate(proximo.getDate() + 1);
        const ms = proximo - ahora;
        console.log(`\x1b[33m[sched] proximo ciclo en ${Math.floor(ms/3600000)}h${Math.floor((ms%3600000)/60000)}m\x1b[0m`);
        setTimeout(() => iniciarCiclos(sock, db, jidPersonal), ms);
    }
}

async function programarSyncDiario(sock) {
    const ahora = new Date();
    const proxima8am = new Date();
    proxima8am.setHours(HORA_SYNC, 0, 0, 0);
    if (proxima8am <= ahora) proxima8am.setDate(proxima8am.getDate() + 1);
    const msHasta8am = proxima8am - ahora;
    
    setTimeout(async () => {
        console.log("\x1b[33m[ SYNC ] Ejecutando sincronizacion diaria (8:00 am)\x1b[0m");
        if (urlSheets) {
            await subirGrupos(sock, urlSheets);
            await sincronizarDescarga(urlSheets);
        }
        programarSyncDiario(sock);
    }, msHasta8am);
}

async function iniciar() {
    console.log("\x1b[34m[ markmitienda ] bot de whatsapp\x1b[0m");
    
    if (!fs.existsSync(DB_PATH)) {
        console.log("\x1b[33m[ aviso ] no hay base de datos. sincronizando...\x1b[0m");
        const url = await cuestion("\x1b[33m[ config ] pega tu url de google sheets: \x1b[0m");
        urlSheets = url;
        if (!await sincronizarDescarga(url)) return console.log("\x1b[31m[ error ] sincronizacion fallida\x1b[0m");
    } else {
        const SQLt = await initSqlJs();
        const dbt = new SQLt.Database(fs.readFileSync(DB_PATH));
        const urlRes = dbt.exec("SELECT valor FROM ajustes WHERE clave = 'url_sheets'");
        if (urlRes[0]) urlSheets = urlRes[0].values[0][0];
    }
    
    if (!carpetaMultimedia) {
        carpetaMultimedia = await cuestion("\x1b[33m[ config ] nombre de carpeta en /sdcard/ (ej: DCIM): \x1b[0m");
        if (!carpetaMultimedia.endsWith("/")) carpetaMultimedia += "/";
        carpetaMultimedia = "/sdcard/" + carpetaMultimedia;
        if (!fs.existsSync(carpetaMultimedia)) console.log("\x1b[33m[ aviso ] carpeta no existe, solo texto\x1b[0m");
    }
    
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log("\x1b[32m[ ok ] base de datos cargada\x1b[0m");
    
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: state, printQRInTerminal: false, logger: pino({ level: "silent" }), browser: ["Ubuntu", "Chrome", "20.0.0"] });
    
    if (!sock.authState.creds.registered && !conexionEstablecida) {
        console.log("\x1b[33m[ info ] vinculacion...\x1b[0m");
        await delay(3000);
        const num = await cuestion("\x1b[33m[ config ] tu numero (ej: 521XXXXXXXXXX): \x1b[0m");
        try {
            const codigo = await sock.requestPairingCode(num.trim());
            console.log(`\x1b[32m\ncodigo: ${codigo}\n\x1b[0m`);
        } catch (e) { console.log(`\x1b[31m[ error ] ${e.message}\x1b[0m`); }
    }
    
    sock.ev.on("creds.update", saveCreds);
    
    sock.ev.on("connection.update", async (u) => {
        if (u.connection === "open" && !conexionEstablecida) {
            conexionEstablecida = true;
            console.log("\x1b[32m[ ok ] whatsapp conectado\x1b[0m");
            console.log("\x1b[36m[ aviso ] escribe 'prueba' en tu chat\x1b[0m");
            const jidPersonal = sock.user.id.split(":")[0] + "@s.whatsapp.net";
            await subirGrupos(sock, urlSheets);
            programarSyncDiario(sock);
            iniciarCiclos(sock, db, jidPersonal);
        } else if (u.connection === "close") {
            console.log("\x1b[31m[ log ] conexion cerrada. esperando 5s...\x1b[0m");
            conexionEstablecida = false;
            await delay(5000);
            if (botActivo) iniciar();
        }
    });
    
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe === false) return;
        const txt = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        if (txt === "prueba") {
            console.log("\x1b[35m[ test ] iniciando...\x1b[0m");
            const grupos = db.exec("SELECT id, nombre FROM grupos");
            const prods = db.exec("SELECT item, descripcion, precio FROM productos");
            if (!grupos[0] || !prods[0]) return console.log("\x1b[31m[ error ] no hay datos\x1b[0m");
            const listaG = grupos[0].values;
            const listaP = prods[0].values;
            const productosEnviados = new Set();
            
            for (const [gid, gnom] of listaG) {
                let disponibles = listaP.filter(p => !productosEnviados.has(p[0]));
                if (disponibles.length === 0) {
                    productosEnviados.clear();
                    disponibles = listaP;
                }
                const prod = r(disponibles);
                const [item, desc, precio] = prod;
                productosEnviados.add(item);
                const delayMsg = Math.floor(Math.random() * (25000 - 7000 + 1) + 7000);
                const plantilla = Math.floor(Math.random() * 3) + 1;
                const contenido = generarMensaje(gnom, item, desc, precio, plantilla);
                console.log(`\x1b[36m[ test ] ${gnom} (${(delayMsg/1000).toFixed(0)}s) plantilla ${plantilla}\x1b[0m`);
                await sock.sendPresenceUpdate('composing', gid);
                await delay(6000);
                await sock.sendPresenceUpdate('paused', gid);
                
                const archivos = [];
                if (fs.existsSync(carpetaMultimedia)) {
                    const arch = fs.readdirSync(carpetaMultimedia);
                    const base = item.toLowerCase();
                    const imagen = arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')));
                    const video = arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.mp4') || f.endsWith('.webm')));
                    if (imagen) archivos.push({ type: 'image', file: imagen });
                    if (video) archivos.push({ type: 'video', file: video });
                }
                
                if (archivos.length > 0) {
                    for (const arch of archivos) {
                        if (arch.type === 'image') await sock.sendMessage(gid, { image: { url: carpetaMultimedia + arch.file }, caption: contenido });
                        else await sock.sendMessage(gid, { video: { url: carpetaMultimedia + arch.file }, caption: contenido });
                        await delay(2000);
                    }
                } else {
                    await sock.sendMessage(gid, { text: contenido });
                }
                
                await sock.sendMessage(msg.key.remoteJid, { text: `[test] ${gnom}\n${item}` });
                await delay(delayMsg);
            }
            console.log("\x1b[32m[ test ] completado\x1b[0m");
        }
    });
}
iniciar();
