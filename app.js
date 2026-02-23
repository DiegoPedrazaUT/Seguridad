require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const crypto = require('crypto');
const session = require('express-session');
const svgCaptcha = require('svg-captcha');

const app = express();
const PORT = process.env.PORT || 3000;

const ipsBloqueadas = new Set();

app.set('trust proxy', 1);

const getRealIp = (req) => {
 
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }
    return req.ip;
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(session({
    secret: 'andobirngryffindor',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 60000 * 5 }
}));

app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
});

app.use((req, res, next) => {
    const clientIp = getRealIp(req);
    if (ipsBloqueadas.has(clientIp)) {
        return res.status(403).render('error', {
            titulo: "ACCESO DENEGADO",
            mensaje: "Tu dirección IP ha sido marcada por actividad maliciosa. No puedes acceder a este sitio.",
            imagen: "https://media.tenor.com/MiQgM3IO5AgAAAAj/shitpost.gif",
            baneado: true,
            ip: clientIp
        });
    }
    next();
});

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "cdn.jsdelivr.net", (req, res) => `'nonce-${res.locals.nonce}'`],
            "style-src": ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"], 
            "font-src": ["'self'", "fonts.gstatic.com"], 
            "img-src": ["'self'", "data:", "https://*.supabase.co", "https://media.tenor.com", "https://c.tenor.com", "https://*.tenor.com"],
            "connect-src": ["'self'", "https://*.supabase.co", "cdn.jsdelivr.net"],
            "frame-ancestors": ["'none'"],
        },
    },
}));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const csrfProtection = csurf({ cookie: true });
app.set('view engine', 'ejs');

const createLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10,
    message: "Demasiados intentos.",
});

// --- RUTA CAPTCHA ---
app.get('/captcha', (req, res) => {
    const captcha = svgCaptcha.create({
        size: 5, ignoreChars: '0o1ilI', noise: 3, color: true, background: '#f0f0f0'
    });
    req.session.captcha = captcha.text.toLowerCase();
    res.type('svg');
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.status(200).send(captcha.data);
});


app.get('/api', (req, res) => {
    const hackerIp = getRealIp(req);
    console.log(`HACKER CAZADO: IP ${hackerIp} baneada.`);
    ipsBloqueadas.add(hackerIp);
    
    res.status(403).render('error', {
        titulo: "¡TE ATRAPAMOS!",
        mensaje: "Has intentado acceder a una ruta restringida. El sistema de defensa ha bloqueado tu IP.",
        imagen: "https://media.tenor.com/aHacr-D6mfcAAAAM/laughing-cat.gif", // GIF de Policia
        baneado: true,
        ip: hackerIp
    });
});

// --- RUTAS PRINCIPALES ---
app.get('/', csrfProtection, async (req, res) => {
    try {
        const { data, error } = await supabase.from('registros').select('*').order('id', { ascending: true });
        res.render('index', { registros: data || [], csrfToken: req.csrfToken(), nonce: res.locals.nonce });
    } catch (err) {
        res.render('index', { registros: [], csrfToken: req.csrfToken(), nonce: res.locals.nonce });
    }
});

app.post('/agregar', createLimiter, csrfProtection,
    body('nombre').trim().escape().isLength({ min: 1, max: 50 }),
    async (req, res) => {
        
        if (req.body.especial_field && req.body.especial_field.length > 0) {
            ipsBloqueadas.add(req.ip); 
            return res.status(403).render('error', {
                titulo: "BOT DETECTADO",
                mensaje: "Hemos detectado comportamiento automatizado.",
                imagen: "https://c.tenor.com/8w89YVypr1AAAAAC/tenor.gif",
                baneado: true,
                ip: req.ip
            });
        }

        // VALIDACIÓN CAPTCHA
        const inputUsuario = req.body.captcha ? req.body.captcha.toLowerCase() : '';
        const captchaSesion = req.session.captcha;

        if (!captchaSesion) {
            return res.render('error', {
                titulo: "La sesión expiró",
                mensaje: "Tardaste mucho o el servidor se reinició. Por seguridad, vuelve a intentarlo.",
                imagen: "https://i.pinimg.com/originals/53/40/bd/5340bd78187d42b45963f76d639e2bbf.gif", 
                baneado: false,
                ip: req.ip
            });
        }
        
        if (inputUsuario !== captchaSesion) {
            req.session.captcha = null;
            return res.render('error', {
                titulo: "Código Incorrecto",
                mensaje: "Los caracteres que ingresaste no coinciden con la imagen. Inténtalo de nuevo.",
                imagen: "https://i.giphy.com/7ovrKs1tz1MsrlbXjV.webp", 
                baneado: false,
                ip: req.ip
            });
        }
        
        req.session.captcha = null;
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).send("Datos inválidos");

        const { nombre } = req.body;
        await supabase.from('registros').insert([{ nombre }]);
        res.redirect('/');
});

app.post('/editar', csrfProtection, 
    body('id').isInt(), 
    body('nuevoNombre').trim().escape().isLength({ min: 1, max: 50 }), 
    async (req, res) => {
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const hackerIp = getRealIp(req);
            console.log(`🚨 INTENTO DE INYECCIÓN EN /editar. Bloqueando IP: ${hackerIp}`);
            ipsBloqueadas.add(hackerIp);
            
            return res.status(403).render('error', {
                titulo: "¡INTENTO DE INYECCIÓN!",
                mensaje: "Se ha detectado una anomalía en los datos. Tu IP ha sido bloqueada.",
                imagen: "https://media.tenor.com/LeRaWzL6NnAAAAAC/anime-police.gif",
                baneado: true,
                ip: hackerIp
            });
        }

        const { id, nuevoNombre } = req.body;
        await supabase.from('registros').update({ nombre: nuevoNombre }).eq('id', id);
        res.redirect('/');
});

app.post('/eliminar', csrfProtection, body('id').isInt(), async (req, res) => {
    await supabase.from('registros').delete().eq('id', req.body.id);
    res.redirect('/');
});

app.listen(PORT, () => console.log(`activa en puerto ${PORT}`));
