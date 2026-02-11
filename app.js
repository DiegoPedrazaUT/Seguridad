require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit'); // Nueva librería

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 1. LIMITADOR DE TASA (Defensa contra spam masivo)
const createLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
    max: 10, // Máximo 10 registros por cada dirección IP
    message: "Has enviado demasiados registros. Por seguridad, espera 15 minutos.",
    standardHeaders: true, 
    legacyHeaders: false,
});

// Seguridad de cabeceras ajustada para Bootstrap y Supabase
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            "style-src": ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            "img-src": ["'self'", "data:", "https://*.supabase.co"],
            "connect-src": ["'self'", "https://*.supabase.co", "cdn.jsdelivr.net"],
            "script-src-attr": ["'unsafe-inline'"]
        },
    },
}));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// --- RUTAS ---

app.get('/', async (req, res) => {
    const { data } = await supabase.from('registros').select('*').order('id', { ascending: true });
    res.render('index', { registros: data || [] });
});

// Aplicamos el limitador específicamente a la ruta de creación
app.post('/agregar', createLimiter, 
    body('nombre').trim().escape().isLength({ min: 1, max: 50 }), 
    async (req, res) => {
        
        // 2. TRAMPA HONEYPOT: Si este campo tiene algo, es un BOT
        if (req.body.especial_field && req.body.especial_field.length > 0) {
            console.log("ATAQUE DE BOT DETECTADO Y BLOQUEADO");
            return res.status(403).send("Error de validación (Bot detectado)");
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).send("Entrada inválida");

        const { nombre } = req.body;
        await supabase.from('registros').insert([{ nombre }]);
        res.redirect('/');
});

app.post('/editar', body('nuevoNombre').trim().escape(), async (req, res) => {
    const { id, nuevoNombre } = req.body;
    await supabase.from('registros').update({ nombre: nuevoNombre }).eq('id', id);
    res.redirect('/');
});

app.post('/eliminar', async (req, res) => {
    await supabase.from('registros').delete().eq('id', req.body.id);
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));