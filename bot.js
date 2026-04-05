const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const readline = require("readline");
const initSqlJs = require('sql.js');
const axios = require('axios');
const { exec } = require('child_process');

exec('termux-wake-lock', (e) => { if (!e) console.log("\x1b[32m[ wake ] activado\x1b[0m"); });

const DB_PATH = './grupospro.sqlite';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const cuestion = (t) => new Promise((r) => rl.question(t, r));

const emojiDB = require('./emojis.js');
const sinonimosDB = require('./sinonimos.js');

const HORA_SYNC = 8;
const HORA_INICIO = 9;
const HORA_FIN = 22;
const MINUTOS_CICLO = 260;
const SEGUNDOS_CICLO = MINUTOS_CICLO * 60;

let botActivo = true;
let conexionEstablecida = false;
let carpetaMultimedia = "";
let urlSheets = "";

const r = (arr) => arr[Math.floor(Math.random() * arr.length)];

function capitalize(s) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function capitalizeEachWord(str) {
    if (!str) return "";
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function getSaludoPorHora() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return r(sinonimosDB.saludos.manana);
    if (h >= 12 && h < 19) return r(sinonimosDB.saludos.tarde);
    return r(sinonimosDB.saludos.noche);
}

function getEmojiProducto(producto) {
    const p = producto.toLowerCase();
    if (p.includes("playera")) return r(emojiDB.productos.playera);
    if (p.includes("gorra")) return r(emojiDB.productos.gorra);
    if (p.includes("vaso") || p.includes("termico")) return r(emojiDB.productos.vaso);
    return r(emojiDB.productos.default);
}

function getGancho() {
    const opciones = [
        { texto: "EXCELENTE OPORTUNIDAD", emoji1: r(emojiDB.promo), emoji2: r(emojiDB.promo) },
        { texto: "MIRA ESTE PRODUCTO", emoji1: r(emojiDB.promo), emoji2: r(emojiDB.promo) },
        { texto: "OFERTA ESPECIAL", emoji1: r(emojiDB.promo), emoji2: r(emojiDB.promo) },
        { texto: "TE PUEDE INTERESAR", emoji1: r(emojiDB.promo), emoji2: r(emojiDB.promo) },
        { texto: "MIRA ESTO", emoji1: r(emojiDB.promo), emoji2: r(emojiDB.promo) }
    ];
    return r(opciones);
}

function getIntro() { return r(sinonimosDB.intro); }
function getCheckEmoji() { return r(emojiDB.check); }
function getNotaEmoji() { return r(emojiDB.nota); }
function getDineroEmoji() { return r(emojiDB.dinero); }

function formatearTexto(producto, descripcion, nombreGrupo) {
    const productoFormateado = capitalizeEachWord(producto);
    const descripcionFormateada = (descripcion && descripcion !== "Sin descripcion") ? capitalize(descripcion) : null;
    const grupoFormateado = `*${capitalizeEachWord(nombreGrupo)}*`;
    return { productoFormateado, descripcionFormateada, grupoFormateado };
}

function generarMensaje(nombreGrupo, producto, descripcion, precio, plantilla) {
    const gancho = getGancho();
    const intro = getIntro();
    const saludoEmoji = r(emojiDB.saludos);
    const saludoHora = getSaludoPorHora();
    const emojiProducto = getEmojiProducto(producto);
    const checkEmoji = getCheckEmoji();
    const notaEmoji = getNotaEmoji();
    const dineroEmoji = getDineroEmoji();
    
    const { productoFormateado, descripcionFormateada, grupoFormateado } = formatearTexto(producto, descripcion, nombreGrupo);
    const tienePrecio = precio && precio !== "" && precio !== "Sin precio";
    const tieneDescripcion = descripcionFormateada !== null;
    
    let msg = "";
    
    if (plantilla === 1) {
        msg = `${gancho.emoji1} *${gancho.texto}* ${gancho.emoji2}\n————————————————————\n> *${intro} ${grupoFormateado}*\n   _${saludoHora}_ ${saludoEmoji}\n————————————————————\n${checkEmoji} *${productoFormateado}* ${emojiProducto}`;
        if (tieneDescripcion) msg += `\n${notaEmoji} ${descripcionFormateada}`;
        if (tienePrecio) msg += `\n${dineroEmoji} *Precio:* $${precio} MXN`;
    } else if (plantilla === 2) {
        msg = `${gancho.emoji1} *${gancho.texto}* ${gancho.emoji2}\n> *${intro} ${grupoFormateado}*\n   _${saludoHora}_ ${saludoEmoji}\n\n${checkEmoji} *${productoFormateado}* ${emojiProducto}`;
        if (tieneDescripcion) msg += `\n${notaEmoji} ${descripcionFormateada}`;
        if (tienePrecio) msg += `\n${dineroEmoji} *Precio:* $${precio} MXN`;
    } else {
        msg = `${gancho.emoji1} *${gancho.texto}* ${gancho.emoji2}\n> *${intro} ${grupoFormateado}*\n   _${saludoHora}_ ${saludoEmoji}\n\n${checkEmoji} *${productoFormateado}* ${emojiProducto}`;
        if (tieneDescripcion) msg += `\n${notaEmoji} ${descripcionFormateada}`;
        if (tienePrecio) msg += `\n${dineroEmoji} *Precio:* $${precio} MXN`;
    }
    
    return msg;
}

function getTiempoRealDisponible() {
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minutosActual = ahora.getMinutes();
    
    if (horaActual < HORA_INICIO) {
        return SEGUNDOS_CICLO * 1000;
    }
    
    if (horaActual >= HORA_FIN) {
        return 0;
    }
    
    const horaInicioCiclo = HORA_INICIO;
    const minutosInicioCiclo = 0;
    let minutosTranscurridos = (horaActual - horaInicioCiclo) * 60 + (minutosActual - minutosInicioCiclo);
    
    if (minutosTranscurridos >= MINUTOS_CICLO * 2) {
        minutosTranscurridos = MINUTOS_CICLO * 2;
    } else if (minutosTranscurridos >= MINUTOS_CICLO) {
        minutosTranscurridos = MINUTOS_CICLO;
    }
    
    const cicloActual = Math.floor(minutosTranscurridos / MINUTOS_CICLO) + 1;
    const minutosRestantes = MINUTOS_CICLO - (minutosTranscurridos % MINUTOS_CICLO);
    
    console.log(`\x1b[33m[ tiempo ] ciclo ${cicloActual} | minutos restantes: ${minutosRestantes}\x1b[0m`);
    
    return minutosRestantes * 60 * 1000;
}

function generarTiemposEnvio(cantidadGrupos, tiempoRealMs) {
    if (tiempoRealMs <= 0 || cantidadGrupos === 0) return [];
    
    const puntos = [];
    for (let i = 0; i < cantidadGrupos; i++) {
        puntos.push(Math.random() * tiempoRealMs);
    }
    puntos.sort((a, b) => a - b);
    
    const delays = [];
    let anterior = 0;
    for (let i = 0; i < puntos.length; i++) {
        delays.push(puntos[i] - anterior);
        anterior = puntos[i];
    }
    
    return delays;
}

function generarListaEnvioProductos(cantidadEnvios, productosLista) {
    const enviosPorProducto = Math.floor(cantidadEnvios / productosLista.length);
    const sobrantes = cantidadEnvios % productosLista.length;
    
    let lista = [];
    for (let i = 0; i < productosLista.length; i++) {
        const cantidad = enviosPorProducto + (i < sobrantes ? 1 : 0);
        for (let j = 0; j < cantidad; j++) {
            lista.push(productosLista[i]);
        }
    }
    
    for (let i = lista.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    
    return lista;
}

async function subirGrupos(sock, url) {
    try {
        const grupos = await sock.groupFetchAllParticipating();
        const lista = Object.entries(grupos).map(([id, info]) => ({ id: id, nombre: info.subject }));
        for (const g of lista) {
            await axios.get(`${url}?action=reporte&id=${encodeURIComponent(g.id)}&nombre=${encodeURIComponent(g.nombre)}`);
            await delay(100);
        }
        console.log(`\x1b[32m[ upload ] subidos ${lista.length} grupos\x1b[0m`);
    } catch (e) { console.log(`\x1b[31m[ upload error ] ${e.message}\x1b[0m`); }
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
            res.data.productos.forEach(p => db.run("INSERT INTO productos VALUES (?,?,?)", [p.item, p.descripcion || "Sin descripcion", p.precio || ""]));
            res.data.grupos.forEach(g => db.run("INSERT INTO grupos VALUES (?,?)", [g.id, g.nombre]));
            fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
            console.log(`\x1b[32m[ sync ] ok | productos: ${res.data.productos.length} | grupos: ${res.data.grupos.length}\x1b[0m`);
            return true;
        }
    } catch (e) { console.log("\x1b[31m[ sync error ]\x1b[0m", e.message); return false; }
    return false;
}

async function enviarMultimedia(sock, gid, contenido, item) {
    const archivos = [];
    if (fs.existsSync(carpetaMultimedia)) {
        const arch = fs.readdirSync(carpetaMultimedia);
        const base = item.toLowerCase();
        const imagen = arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')));
        const video = arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.mp4') || f.endsWith('.webm')));
        if (imagen) archivos.push({ type: 'image', file: imagen, texto: contenido });
        if (video) archivos.push({ type: 'video', file: video, texto: `🎥 Mira el video de ${capitalizeEachWord(item)}` });
    }
    
    if (archivos.length > 0) {
        for (const arch of archivos) {
            if (arch.type === 'image') await sock.sendMessage(gid, { image: { url: carpetaMultimedia + arch.file }, caption: arch.texto });
            else await sock.sendMessage(gid, { video: { url: carpetaMultimedia + arch.file }, caption: arch.texto });
            await delay(2000);
        }
    } else {
        await sock.sendMessage(gid, { text: contenido });
    }
}

async function ejecutarCiclo(sock, db, jidPersonal, cicloNum, gruposLista, productosLista, tiempoRealMs) {
    if (!botActivo) return;
    const cantidad = gruposLista.length;
    const delays = generarTiemposEnvio(cantidad, tiempoRealMs);
    const minutosRestantes = Math.floor(tiempoRealMs / 60000);
    
    console.log(`\x1b[35m[ciclo ${cicloNum}] inicio | grupos: ${cantidad} | tiempo real: ${minutosRestantes}min\x1b[0m`);
    
    const listaEnvios = generarListaEnvioProductos(cantidad, productosLista);
    
    for (let i = 0; i < gruposLista.length; i++) {
        if (!botActivo) break;
        const [gid, gnom] = gruposLista[i];
        const [item, desc, precio] = listaEnvios[i];
        
        const delayMs = delays[i];
        const plantilla = Math.floor(Math.random() * 3) + 1;
        const contenido = generarMensaje(gnom, item, desc, precio, plantilla);
        
        console.log(`\x1b[36m[ciclo ${cicloNum}] ${gnom} | espera: ${(delayMs/1000).toFixed(0)}s | producto: ${item}\x1b[0m`);
        
        await delay(delayMs);
        
        await sock.sendPresenceUpdate('composing', gid);
        await delay(6000);
        await sock.sendPresenceUpdate('paused', gid);
        
        await enviarMultimedia(sock, gid, contenido, item);
        await sock.sendMessage(jidPersonal, { text: `[ciclo ${cicloNum}] ${gnom}\n${item}` });
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
            const tiempoRealMs = getTiempoRealDisponible();
            
            if (tiempoRealMs > 0 && listaG.length > 0) {
                await ejecutarCiclo(sock, db, jidPersonal, 1, listaG, listaP, tiempoRealMs);
            }
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
        console.log("\x1b[33m[ sync ] ejecutando sincronizacion diaria (8:00 am)\x1b[0m");
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
            const tiempoRealMs = getTiempoRealDisponible();
            
            if (tiempoRealMs <= 0) {
                console.log("\x1b[33m[ test ] fuera de horario, no se envia\x1b[0m");
                return;
            }
            
            const delays = generarTiemposEnvio(listaG.length, tiempoRealMs);
            const listaEnvios = generarListaEnvioProductos(listaG.length, listaP);
            
            for (let i = 0; i < listaG.length; i++) {
                const [gid, gnom] = listaG[i];
                const [item, desc, precio] = listaEnvios[i];
                const delayMs = delays[i];
                const plantilla = Math.floor(Math.random() * 3) + 1;
                const contenido = generarMensaje(gnom, item, desc, precio, plantilla);
                console.log(`\x1b[36m[ test ] ${gnom} | espera: ${(delayMs/1000).toFixed(0)}s | producto: ${item}\x1b[0m`);
                await delay(delayMs);
                await sock.sendPresenceUpdate('composing', gid);
                await delay(6000);
                await sock.sendPresenceUpdate('paused', gid);
                await enviarMultimedia(sock, gid, contenido, item);
                await sock.sendMessage(msg.key.remoteJid, { text: `[test] ${gnom}\n${item}` });
            }
            console.log("\x1b[32m[ test ] completado\x1b[0m");
        }
    });
}
iniciar();
