require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const app = express();

// 1. Configuración de Proxy (Indispensable para Render)
// Esto permite que el Rate Limit vea la IP real del usuario y no la de Render
app.set('trust proxy', 1); 

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 2. Definición del Limitador
const createLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, 
    max: 10, 
    message: "Has enviado demasiados registros. Por seguridad, espera 15 minutos.",
    standardHeaders: true, 
    legacyHeaders: false,
});

// 3. Seguridad de cabeceras (CSP)
// Aquí quitamos el duplicado y dejamos solo la configuración que permite Bootstrap
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

app.post('/agregar', createLimiter, 
    body('nombre').trim().escape().isLength({ min: 1, max: 50 }), 
    async (req, res) => {
        
        // TRAMPA HONEYPOT: Bloqueo inmediato de bots
        if (req.body.especial_field && req.body.especial_field.length > 0) {
            console.log("BOT BLOQUEADO");
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