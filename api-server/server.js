const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1234567890',
  database: 'appUsuarios'
});

db.connect(err => {
  if (err) {
    console.error('Error conectando a MySQL:', err);
    return;
  }
  console.log('Conectado a MySQL');
});

// Ruta para registrar usuario
app.post('/register', (req, res) => {
  const { nombre, correo, contrasena } = req.body;
  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ message: 'Faltan datos' });
  }

  const query = 'INSERT INTO usuarios (nombre, correo, contrasena) VALUES (?, ?, ?)';
  db.query(query, [nombre, correo, contrasena], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Correo ya registrado' });
      }
      return res.status(500).json({ message: 'Error en la base de datos' });
    }
    res.status(201).json({ message: 'Usuario registrado correctamente' });
  });
});

app.post('/login', (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ message: 'Faltan datos' });
  }

  const query = 'SELECT * FROM usuarios WHERE correo = ? AND contrasena = ?';
  db.query(query, [correo, contrasena], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error en la base de datos' });
    }
    if (results.length > 0) {
      res.json({ message: 'Login exitoso' });
    } else {
      res.status(401).json({ message: 'Correo o contraseña incorrectos' });
    }
  });
});

app.post('/reportes', (req, res) => {
  const { descripcion, latitud, longitud } = req.body;
  
  if (!descripcion || !latitud || !longitud) {
    return res.status(400).json({ message: 'Faltan datos: descripcion, latitud y longitud son requeridos' });
  }

  const query = 'INSERT INTO reportes (descripcion, latitud, longitud) VALUES (?, ?, ?)';
  db.query(query, [descripcion, latitud, longitud], (err, result) => {
    if (err) {
      console.error('Error insertando reporte:', err);
      return res.status(500).json({ message: 'Error en la base de datos' });
    }
    res.status(201).json({ 
      message: 'Reporte creado correctamente',
      id: result.insertId 
    });
  });
});

// Ruta para obtener todos los reportes
app.get('/reportes', (req, res) => {
  const query = 'SELECT * FROM reportes ORDER BY fecha DESC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo reportes:', err);
      return res.status(500).json({ message: 'Error en la base de datos' });
    }
    res.json(results);
  });
});

// Ruta para obtener un reporte específico por ID
app.get('/reportes/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM reportes WHERE id = ?';
  
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error obteniendo reporte:', err);
      return res.status(500).json({ message: 'Error en la base de datos' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Reporte no encontrado' });
    }
    
    res.json(results[0]);
  });
});

// Ruta para eliminar un reporte
app.delete('/reportes/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM reportes WHERE id = ?';
  
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error eliminando reporte:', err);
      return res.status(500).json({ message: 'Error en la base de datos' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Reporte no encontrado' });
    }
    
    res.json({ message: 'Reporte eliminado correctamente' });
  });
});



app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor corriendo en http://0.0.0.0:3000');
});

