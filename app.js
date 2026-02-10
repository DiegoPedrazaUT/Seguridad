require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

const app = express();

// Configuración de Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middlewares de Seguridad y Configuración
app.use(helmet()); 
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// --- RUTAS DEL CRUD ---

// 1. LEER: Obtiene los registros de Supabase
app.get('/', async (req, res) => {
    const { data, error } = await supabase
        .from('registros')
        .select('*')
        .order('id', { ascending: true });
    
    res.render('index', { registros: data || [] });
});

// 2. CREAR: Punto de inyección protegido
app.post('/agregar', 
    body('nombre').trim().escape().isLength({ min: 1, max: 50 }), 
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).send("Entrada no válida.");

        const { nombre } = req.body;
        await supabase.from('registros').insert([{ nombre }]);
        res.redirect('/');
});

// 3. EDITAR: Procesa el cambio desde el Modal
app.post('/editar', 
    body('nuevoNombre').trim().escape().isLength({ min: 1 }), 
    async (req, res) => {
        const { id, nuevoNombre } = req.body;
        
        const { error } = await supabase
            .from('registros')
            .update({ nombre: nuevoNombre })
            .eq('id', id);

        if (error) console.error("Error update:", error);
        res.redirect('/');
});

// 4. ELIMINAR
app.post('/eliminar', async (req, res) => {
    const { id } = req.body;
    await supabase.from('registros').delete().eq('id', id);
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));