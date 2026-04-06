import { makeWASocket, useMultiFileAuthState, delay, DisconnectReason } from 'baileys';
import pino from 'pino';
import fs from 'fs';
import readline from 'readline';
import initSqlJs from 'sql.js';
import axios from 'axios';
import { exec } from 'child_process';
import emojiDB from './emojis.js';
import sinonimosDB from './sinonimos.js';

const VERSION = 'latest';

exec('termux-wake-lock', (e) => { if (!e) console.log("\x1b[32m[ WAKE ] Activado\x1b[0m"); });

const CONFIG_PATH = './config.json';
const DB_PATH = './grupospro.sqlite';

const HORA_SYNC = 8;
const HORA_INICIO = 9;
const HORA_FIN = 22;
const MINUTOS_CICLO = 260;
const SEGUNDOS_CICLO = MINUTOS_CICLO * 60;

let botActivo = true;
let conexionEstablecida = false;
let carpetaMultimedia = "";
let urlSheets = "";
let reconectando = false;
let tiempoInicio = Date.now();

const r = (arr) => arr[Math.floor(Math.random() * arr.length)];

function logTiempo(etapa) {
    const elapsed = ((Date.now() - tiempoInicio) / 1000).toFixed(1);
    console.log(`\x1b[33m[ tiempo ] ${etapa}: ${elapsed}s\x1b[0m`);
}

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
    const productoFormateado = `*_${capitalizeEachWord(producto)}_*`;
    const descripcionFormateada = (descripcion && descripcion !== "Sin descripcion") ? capitalize(descripcion) : null;
    const grupoFormateado = `*${capitalizeEachWord(nombreGrupo)}*`;
    return { productoFormateado, descripcionFormateada, grupoFormateado };
}

function generarMensaje(nombreGrupo, producto, descripcion, precio, plantilla) {
    const gancho = getGancho();
    const intro = `_${getIntro()}_`;
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
        msg = `${gancho.emoji1} *${gancho.texto}* ${gancho.emoji2}\n————————————————————\n> ${intro} ${grupoFormateado}\n   _${saludoHora}_ ${saludoEmoji}\n————————————————————\n${checkEmoji} ${productoFormateado} ${emojiProducto}`;
        if (tieneDescripcion) msg += `\n${notaEmoji} ${descripcionFormateada}`;
        if (tienePrecio) msg += `\n${dineroEmoji} *Precio:* $${precio} MXN`;
    } else if (plantilla === 2) {
        msg = `${gancho.emoji1} *${gancho.texto}* ${gancho.emoji2}\n> ${intro} ${grupoFormateado}\n   _${saludoHora}_ ${saludoEmoji}\n\n${checkEmoji} ${productoFormateado} ${emojiProducto}`;
        if (tieneDescripcion) msg += `\n${notaEmoji} ${descripcionFormateada}`;
        if (tienePrecio) msg += `\n${dineroEmoji} *Precio:* $${precio} MXN`;
    } else {
        msg = `${gancho.emoji1} *${gancho.texto}* ${gancho.emoji2}\n> ${intro} ${grupoFormateado}\n   _${saludoHora}_ ${saludoEmoji}\n\n${checkEmoji} ${productoFormateado} ${emojiProducto}`;
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
    
    const minutosTranscurridos = (horaActual - HORA_INICIO) * 60 + minutosActual;
    const cicloActual = Math.floor(minutosTranscurridos / MINUTOS_CICLO);
    
    if (cicloActual >= 3) {
        return 0;
    }
    
    const minutosEnCicloActual = minutosTranscurridos % MINUTOS_CICLO;
    const minutosRestantes = MINUTOS_CICLO - minutosEnCicloActual;
    
    console.log(`\x1b[33m[ tiempo ] ciclo ${cicloActual + 1} | minutos restantes: ${minutosRestantes}\x1b[0m`);
    
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

async function grupoExisteEnSheet(url, id) {
    try {
        const res = await axios.get(url);
        if (res.data.status === "success") {
            const gruposExistentes = res.data.grupos || [];
            return gruposExistentes.some(g => g.id === id);
        }
    } catch (e) {
        console.log(`\x1b[31m[ error ] al verificar grupo: ${e.message}\x1b[0m`);
    }
    return false;
}

async function subirGrupos(sock, url) {
    try {
        const grupos = await sock.groupFetchAllParticipating();
        const lista = Object.entries(grupos).map(([id, info]) => ({ id: id, nombre: info.subject }));
        let nuevos = 0;
        
        for (const g of lista) {
            const existe = await grupoExisteEnSheet(url, g.id);
            if (!existe) {
                await axios.get(`${url}?action=reporte&id=${encodeURIComponent(g.id)}&nombre=${encodeURIComponent(g.nombre)}`);
                nuevos++;
                await delay(100);
            }
        }
        console.log(`\x1b[32m[ upload ] subidos ${nuevos} grupos nuevos (${lista.length - nuevos} ya existian)\x1b[0m`);
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
            db.run("DELETE FROM productos");
            db.run("DELETE FROM grupos");
            res.data.productos.forEach(p => db.run("INSERT INTO productos VALUES (?,?,?)", [p.item, p.descripcion || "Sin descripcion", p.precio || ""]));
            res.data.grupos.forEach(g => db.run("INSERT INTO grupos VALUES (?,?)", [g.id, g.nombre]));
            fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
            console.log(`\x1b[32m[ sync ] ok | productos: ${res.data.productos.length} | grupos: ${res.data.grupos.length}\x1b[0m`);
            logTiempo("sincronizacion");
            return true;
        }
    } catch (e) { console.log("\x1b[31m[ sync error ]\x1b[0m", e.message); return false; }
    return false;
}

function getTextoMultimedia(tipo, item) {
    const itemFormateado = `*_${capitalizeEachWord(item)}_*`;
    const opcionesVideo = [
        `🎥 Mira el video de ${itemFormateado}`,
        `📹 Video demostracion de ${itemFormateado}`,
        `🎬 Observa el video de ${itemFormateado}`
    ];
    const opcionesDocumento = [
        `📄 Checa este documento de ${itemFormateado}`,
        `📑 Informacion detallada de ${itemFormateado}`,
        `📋 Ficha tecnica de ${itemFormateado}`,
        `📎 Especificaciones de ${itemFormateado}`
    ];
    
    if (tipo === 'video') return r(opcionesVideo);
    if (tipo === 'documento') return r(opcionesDocumento);
    return "";
}

async function enviarMultimedia(sock, gid, contenido, item) {
    const archivos = [];
    if (fs.existsSync(carpetaMultimedia)) {
        const arch = fs.readdirSync(carpetaMultimedia);
        const base = item.toLowerCase();
        const imagen = arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg')));
        const video = arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.mp4') || f.endsWith('.webm')));
        const documento = arch.find(f => f.toLowerCase().includes(base) && (f.endsWith('.pdf') || f.endsWith('.docx')));
        if (imagen) archivos.push({ type: 'image', file: imagen, texto: contenido });
        if (video) archivos.push({ type: 'video', file: video, texto: getTextoMultimedia('video', item) });
        if (documento) archivos.push({ type: 'documento', file: documento, texto: getTextoMultimedia('documento', item) });
    }
    
    if (archivos.length > 0) {
        for (const arch of archivos) {
            try {
                if (arch.type === 'image') await sock.sendMessage(gid, { image: { url: carpetaMultimedia + arch.file }, caption: arch.texto });
                else if (arch.type === 'video') await sock.sendMessage(gid, { video: { url: carpetaMultimedia + arch.file }, caption: arch.texto });
                else await sock.sendMessage(gid, { document: { url: carpetaMultimedia + arch.file }, caption: arch.texto });
                await delay(2000);
            } catch (e) {
                console.log(`\x1b[31m[ error ] enviar ${arch.type}: ${e.message}\x1b[0m`);
            }
        }
    } else {
        try {
            await sock.sendMessage(gid, { text: contenido });
        } catch (e) {
            console.log(`\x1b[31m[ error ] enviar texto: ${e.message}\x1b[0m`);
        }
    }
}

async function ejecutarCiclo(sock, db, jidPersonal, cicloNum, gruposLista, productosLista, tiempoRealMs) {
    if (!botActivo) return;
    const cantidad = gruposLista.length;
    const delays = generarTiemposEnvio(cantidad, tiempoRealMs);
    const minutosRestantes = Math.floor(tiempoRealMs / 60000);
    
    console.log(`\x1b[35m[ciclo ${cicloNum}] inicio | grupos: ${cantidad} | tiempo real: ${minutosRestantes}min\x1b[0m`);
    
    const listaEnvios = generarListaEnvioProductos(cantidad, productosLista);
    const contadorProductos = {};
    
    for (const [item] of listaEnvios) {
        contadorProductos[item] = (contadorProductos[item] || 0) + 1;
    }
    
    const inicioCiclo = Date.now();
    
    for (let i = 0; i < gruposLista.length; i++) {
        if (!botActivo) break;
        const [gid, gnom] = gruposLista[i];
        const [item, desc, precio] = listaEnvios[i];
        
        const delayMs = delays[i];
        const plantilla = Math.floor(Math.random() * 3) + 1;
        const contenido = generarMensaje(gnom, item, desc, precio, plantilla);
        
        console.log(`\x1b[36m[ciclo ${cicloNum}] ${gnom} | espera: ${(delayMs/1000).toFixed(0)}s | producto: ${item}\x1b[0m`);
        
        await delay(delayMs);
        
        try {
            await sock.sendPresenceUpdate('composing', gid);
            await delay(6000);
            await sock.sendPresenceUpdate('paused', gid);
        } catch (e) {
            console.log(`\x1b[31m[ error ] typing en ${gnom}: ${e.message}\x1b[0m`);
            continue;
        }
        
        await enviarMultimedia(sock, gid, contenido, item);
        await delay(1000);
    }
    
    const tiempoCiclo = ((Date.now() - inicioCiclo) / 60000).toFixed(1);
    
    let resumenProductos = "";
    for (const [prod, count] of Object.entries(contadorProductos)) {
        if (resumenProductos) resumenProductos += ", ";
        resumenProductos += `${prod} (${count})`;
    }
    
    const mensajeResumen = `[ciclo ${cicloNum}] completado\nGrupos: ${cantidad}\nProductos: ${resumenProductos}\nTiempo real: ${minutosRestantes}min\nDuracion: ${tiempoCiclo}min`;
    await sock.sendMessage(jidPersonal, { text: mensajeResumen });
    console.log(`\x1b[32m[ciclo ${cicloNum}] completado | duracion: ${tiempoCiclo}min\x1b[0m`);
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

let watchdogInterval;
let ultimoMensaje = Date.now();

function iniciarWatchdog(sock, db, jidPersonal) {
    if (watchdogInterval) clearInterval(watchdogInterval);
    watchdogInterval = setInterval(async () => {
        if (!botActivo) return;
        const tiempoSinMensajes = (Date.now() - ultimoMensaje) / 1000;
        if (tiempoSinMensajes > 300 && !reconectando) {
            console.log(`\x1b[33m[ watchdog ] ${tiempoSinMensajes}s sin actividad, verificando conexion...\x1b[0m`);
            try {
                await sock.sendPresenceUpdate('available');
                ultimoMensaje = Date.now();
                console.log(`\x1b[32m[ watchdog ] conexion activa\x1b[0m`);
            } catch (e) {
                console.log(`\x1b[31m[ watchdog ] conexion caida: ${e.message}\x1b[0m`);
                reconectando = true;
                botActivo = false;
                setTimeout(() => {
                    console.log(`\x1b[33m[ watchdog ] reiniciando bot...\x1b[0m`);
                    iniciar();
                }, 5000);
            }
        }
    }, 60000);
}

async function leerConfiguracion() {
    if (fs.existsSync(CONFIG_PATH)) {
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    }
    return null;
}

async function guardarConfiguracion(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function preguntarConfiguracion() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const cuestion = (t) => new Promise((r) => rl.question(t, r));
    
    console.log("\x1b[33m[ CONFIG ] Primera ejecucion. Configurando...\x1b[0m");
    const urlSheets = await cuestion("\x1b[33m[ CONFIG ] Pega tu URL de Google Sheets: \x1b[0m");
    let carpeta = await cuestion("\x1b[33m[ CONFIG ] Nombre de carpeta en /sdcard/ (ej: DCIM): \x1b[0m");
    if (!carpeta.endsWith("/")) carpeta += "/";
    carpeta = "/sdcard/" + carpeta;
    
    rl.close();
    await delay(500);
    
    return { urlSheets, carpetaMultimedia: carpeta };
}

async function iniciar() {
    tiempoInicio = Date.now();
    console.log("\x1b[34m[ MARKMITIENDA ] Bot de WhatsApp\x1b[0m");
    
    const config = await leerConfiguracion();
    if (config) {
        urlSheets = config.urlSheets;
        carpetaMultimedia = config.carpetaMultimedia;
        console.log("\x1b[32m[ CONFIG ] Configuracion cargada\x1b[0m");
    } else {
        const nuevaConfig = await preguntarConfiguracion();
        urlSheets = nuevaConfig.urlSheets;
        carpetaMultimedia = nuevaConfig.carpetaMultimedia;
        await guardarConfiguracion(nuevaConfig);
        console.log("\x1b[32m[ CONFIG ] Configuracion guardada\x1b[0m");
    }
    
    if (!fs.existsSync(DB_PATH)) {
        console.log("\x1b[33m[ AVISO ] No hay base de datos. Sincronizando...\x1b[0m");
        if (!await sincronizarDescarga(urlSheets)) return console.log("\x1b[31m[ ERROR ] Sincronizacion fallida\x1b[0m");
    } else {
        const SQL = await initSqlJs();
        const dbt = new SQL.Database(fs.readFileSync(DB_PATH));
        const urlRes = dbt.exec("SELECT valor FROM ajustes WHERE clave = 'url_sheets'");
        if (urlRes[0]) urlSheets = urlRes[0].values[0][0];
    }
    
    if (!fs.existsSync(carpetaMultimedia)) {
        console.log("\x1b[33m[ AVISO ] Carpeta no existe, solo texto\x1b[0m");
    }
    
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log("\x1b[32m[ OK ] Base de datos cargada\x1b[0m");
    
    await delay(1000);
    
    const { state, saveCreds } = await useMultiFileAuthState('sesion_auth');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Windows", "Chrome", "114.0.5735.198"]
    });
    
    let pairingCodeRequested = false;
    
    sock.ev.on("creds.update", saveCreds);
    
    sock.ev.on("connection.update", async (u) => {
        const { connection, lastDisconnect } = u;
        
        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === DisconnectReason.loggedOut) {
                console.log("\x1b[31m[ ERROR ] Sesion cerrada. Elimina la carpeta 'sesion_auth' y reinicia.\x1b[0m");
                botActivo = false;
            } else if (!reconectando) {
                console.log("\x1b[31m[ LOG ] Conexion cerrada. Esperando 5s...\x1b[0m");
                reconectando = true;
                await delay(5000);
                if (botActivo) iniciar();
            }
            return;
        }
        
        if (connection === "open" && !sock.authState.creds.registered && !pairingCodeRequested) {
            pairingCodeRequested = true;
            console.log("\x1b[33m[ INFO ] Conexion abierta. Preparando vinculacion...\x1b[0m");
            await delay(2000);
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const cuestionNum = (t) => new Promise((r) => rl.question(t, r));
            const num = await cuestionNum("\x1b[33m[ CONFIG ] Tu numero (ej: 521XXXXXXXXXX): \x1b[0m");
            rl.close();
            try {
                console.log("\x1b[33m[ INFO ] Solicitando codigo de emparejamiento...\x1b[0m");
                const codigo = await sock.requestPairingCode(num.trim());
                console.log(`\x1b[32m\n=========================================\nCODIGO: ${codigo}\n=========================================\n\x1b[0m`);
                logTiempo("vinculacion");
            } catch (e) {
                console.log(`\x1b[31m[ ERROR ] Fallo al solicitar el codigo: ${e.message}\x1b[0m`);
                pairingCodeRequested = false;
            }
        }
        
        if (connection === "open" && sock.authState.creds.registered && !conexionEstablecida) {
            conexionEstablecida = true;
            logTiempo("estabilizacion");
            console.log("\x1b[32m[ OK ] WhatsApp conectado\x1b[0m");
            console.log("\x1b[36m[ AVISO ] Escribe 'prueba' en tu chat\x1b[0m");
            const jidPersonal = sock.user.id.split(":")[0] + "@s.whatsapp.net";
            await subirGrupos(sock, urlSheets);
            programarSyncDiario(sock);
            iniciarWatchdog(sock, db, jidPersonal);
            iniciarCiclos(sock, db, jidPersonal);
        }
    });
    
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe === false) return;
        const txt = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        if (txt === "prueba") {
            ultimoMensaje = Date.now();
            console.log("\x1b[35m[ TEST ] Iniciando...\x1b[0m");
            const grupos = db.exec("SELECT id, nombre FROM grupos");
            const prods = db.exec("SELECT item, descripcion, precio FROM productos");
            if (!grupos[0] || !prods[0]) return console.log("\x1b[31m[ ERROR ] No hay datos\x1b[0m");
            const listaG = grupos[0].values;
            const listaP = prods[0].values;
            const tiempoRealMs = getTiempoRealDisponible();
            
            if (tiempoRealMs <= 0) {
                console.log("\x1b[33m[ TEST ] Fuera de horario, no se envia\x1b[0m");
                return;
            }
            
            const delays = generarTiemposEnvio(listaG.length, tiempoRealMs);
            const listaEnvios = generarListaEnvioProductos(listaG.length, listaP);
            const contadorProductos = {};
            
            for (const [item] of listaEnvios) {
                contadorProductos[item] = (contadorProductos[item] || 0) + 1;
            }
            
            for (let i = 0; i < listaG.length; i++) {
                const [gid, gnom] = listaG[i];
                const [item, desc, precio] = listaEnvios[i];
                const delayMs = delays[i];
                const plantilla = Math.floor(Math.random() * 3) + 1;
                const contenido = generarMensaje(gnom, item, desc, precio, plantilla);
                console.log(`\x1b[36m[ TEST ] ${gnom} | espera: ${(delayMs/1000).toFixed(0)}s | producto: ${item}\x1b[0m`);
                await delay(delayMs);
                try {
                    await sock.sendPresenceUpdate('composing', gid);
                    await delay(6000);
                    await sock.sendPresenceUpdate('paused', gid);
                } catch (e) {
                    console.log(`\x1b[31m[ ERROR ] Typing en ${gnom}: ${e.message}\x1b[0m`);
                    continue;
                }
                await enviarMultimedia(sock, gid, contenido, item);
                await delay(1000);
                ultimoMensaje = Date.now();
            }
            
            let resumenProductos = "";
            for (const [prod, count] of Object.entries(contadorProductos)) {
                if (resumenProductos) resumenProductos += ", ";
                resumenProductos += `${prod} (${count})`;
            }
            
            console.log(`\x1b[32m[ TEST ] Completado | grupos: ${listaG.length} | productos: ${resumenProductos}\x1b[0m`);
            await sock.sendMessage(msg.key.remoteJid, { text: `[TEST] Completado\nGrupos: ${listaG.length}\nProductos: ${resumenProductos}` });
        }
    });
}

iniciar();
