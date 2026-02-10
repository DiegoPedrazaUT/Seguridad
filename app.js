require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(helmet()); // Protege cabeceras HTTP
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// RUTA: Leer datos
app.get('/', async (req, res) => {
    const { data } = await supabase.from('registros').select('*').order('id');
    res.render('index', { registros: data || [] });
});

// RUTA: Agregar (Inmune a SQL Injection)
app.post('/agregar', 
    body('nombre').trim().escape().isLength({ min: 1, max: 50 }), 
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).send("Entrada maliciosa detectada.");

        const { nombre } = req.body;
        await supabase.from('registros').insert([{ nombre }]);
        res.redirect('/');
});

// RUTA: Editar
app.post('/editar', body('nuevoNombre').trim().escape(), async (req, res) => {
    const { id, nuevoNombre } = req.body;
    await supabase.from('registros').update({ nombre: nuevoNombre }).eq('id', id);
    res.redirect('/');
});

// RUTA: Eliminar
app.post('/eliminar', async (req, res) => {
    await supabase.from('registros').delete().eq('id', req.body.id);
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));