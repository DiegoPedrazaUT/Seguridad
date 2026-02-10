require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// CONFIGURACIÓN DE SEGURIDAD REFINADA
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            // Permite scripts de JSdelivr y scripts en línea (como tu función de modal)
            "script-src": ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            // Permite estilos de Bootstrap
            "style-src": ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
            // Permite imágenes y conexión con Supabase
            "img-src": ["'self'", "data:", "https://*.supabase.co"],
            "connect-src": ["'self'", "https://*.supabase.co", "cdn.jsdelivr.net"],
            // IMPORTANTE: Permite los atributos onclick
            "script-src-attr": ["'unsafe-inline'"]
        },
    },
}));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// --- RUTAS (Se mantienen igual) ---

app.get('/', async (req, res) => {
    const { data } = await supabase.from('registros').select('*').order('id');
    res.render('index', { registros: data || [] });
});

app.post('/agregar', 
    body('nombre').trim().escape().isLength({ min: 1, max: 50 }), 
    async (req, res) => {
        if (!validationResult(req).isEmpty()) return res.status(400).send("Entrada inválida");
        await supabase.from('registros').insert([{ nombre: req.body.nombre }]);
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
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));