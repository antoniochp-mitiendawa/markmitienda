// =========================================================
// PROYECTO: grupospro
// ARCHIVO: sinonimos.js
// FUNCIÓN: Diccionario de Fraseo Persuasivo y Saludos
// =========================================================

const sinonimosDB = {
    // --- SECCIÓN 1: SALUDOS Y CORTESÍA (POR HORARIO) ---
    saludos: {
        manana: [
            "¡Buenos días!", "¡Muy buen día!", "¡Excelente mañana!", "¡Qué tal, buen día!", 
            "¡Feliz amanecer!", "¡Iniciando con todo el día!", "¡Bendecido día!", 
            "¡Espero que tengas una gran mañana!", "¡Hola, qué gusto saludarte esta mañana!"
        ],
        tarde: [
            "¡Buenas tardes!", "¡Excelente tarde!", "¡Qué tal va tu tarde!", "¡Feliz tarde!", 
            "¡Qué gusto saludarte!", "¡Espero que estés teniendo una tarde productiva!", 
            "¡Hola, provecho si estás comiendo!", "¡Disfruta de esta tarde!"
        ],
        noche: [
            "¡Buenas noches!", "¡Excelente noche!", "¡Feliz descanso!", "¡Qué tal tu noche!", 
            "¡Espero que hayas tenido un gran día!", "¡Hola, cerrando el día con lo mejor!", 
            "¡Linda noche!", "¡Ya es hora de relajarse, buenas noches!"
        ],
        generales: [
            "¡Hola!", "¡Qué tal!", "¿Cómo estás?", "¡Qué gusto verte por aquí!", 
            "¡Saludos!", "¡Hey!", "¿Qué hay de nuevo?", "¡Un gusto saludarte!"
        ]
    },

    // --- SECCIÓN 2: GANCHOS DE VENTA Y OFERTAS (PSICOLOGÍA DE COMPRA) ---
    ofertas: {
        introduccion: [
            "Mira lo que tenemos para ti:", "¡Checa esta oportunidad!", "¡Atención a esto!", 
            "No dejes pasar esto:", "¡Ojo con esta promoción!", "¡Te va a encantar esto!", 
            "¿Ya viste lo que llegó?", "Recién salido para ti:", "Mira este detalle:", 
            "Observa esta increíble opción:", "¡Directo a tu alcance!"
        ],
        urgencia_descuento: [
            "¡Oferta exclusiva!", "¡Promoción por tiempo limitado!", "¡Precio especial hoy!", 
            "¡Descuento imperdible!", "¡Liquidación total!", "¡Solo por hoy!", 
            "¡Gran oportunidad de ahorro!", "¡Aprovecha el precio de locura!", 
            "¡Últimas unidades disponibles!", "¡Corre que se acaban!"
        ],
        calidad_valor: [
            "Calidad garantizada", "Lo mejor del mercado", "Hecho para durar", 
            "Simplemente espectacular", "La mejor elección que puedes hacer", 
            "Producto premium a tu alcance", "Diseño y funcionalidad en uno solo", 
            "¡No encontrarás nada igual!", "Elegancia y resistencia total"
        ]
    },

    // --- SECCIÓN 3: LLAMADAS A LA ACCIÓN (CALL TO ACTION) ---
    llamadas_accion: {
        pedido: [
            "Pide el tuyo ahora mismo", "Mándame un mensaje para apartarlo", 
            "Haz tu pedido aquí", "No te quedes sin el tuyo, ¡escríbeme!", 
            "Dale clic para ordenar", "¡Lo quiero!", "Apártalo con un mensaje", 
            "¡Llévatelo hoy mismo!", "Escríbeme para darte detalles"
        ],
        info_extra: [
            "Pregunta sin compromiso", "Estamos para servirte", "Cualquier duda, avísame", 
            "Más info por privado", "Solicita el catálogo completo", 
            "Si necesitas más fotos, pídeme", "Te doy toda la información aquí"
        ]
    },

    // --- SECCIÓN 4: CONECTORES DE PRODUCTO ---
    conectores: [
        "especialmente para ti", "pensando en tu comodidad", "perfecto para tu día a día", 
        "el complemento ideal", "lo que estabas buscando", "ideal para regalar", 
        "diseñado para exigentes", "una pieza única"
    ]
};

module.exports = sinonimosDB;
