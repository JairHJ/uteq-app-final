// ------------------------------
// GUÍA DE ENVÍO DE ALERTAS UTEQ
// ------------------------------
// Según el nivel de alerta, los correos se envían a:
//
// - ROJO:      2022171044@uteq.edu.mx
// - AMARILLO:  2022171044@uteq.edu.mx, 2022171044@uteq.edu.mx
// - VERDE:     2022171044@uteq.edu.mx, 2022171044@uteq.edu.mx
//
// Puedes modificar los destinatarios en el objeto ALERT_EMAILS.
//
// Ejemplo de uso:
//   ALERT_EMAILS = {
//     rojo: ['correo1@dominio.com'],
//     amarillo: ['correo2@dominio.com', 'correo3@dominio.com'],
//     verde: ['correo4@dominio.com']
//   }
// ------------------------------

const express = require('express');
const nodemailer = require('nodemailer');

// Configuración de correos por nivel de alerta
const ALERT_EMAILS = {
  rojo: ['2022171044@uteq.edu.mx'],
  amarillo: ['2022171044@uteq.edu.mx', '2022171044@uteq.edu.mx'],
  verde: ['2022171044@uteq.edu.mx', '2022171044@uteq.edu.mx']
};


// Solo una declaración de app
const app = express();

// Endpoint para obtener los destinatarios de correo por nivel de alerta
app.get('/alert-emails', (req, res) => {
  res.json({
    rojo: ALERT_EMAILS.rojo,
    amarillo: ALERT_EMAILS.amarillo,
    verde: ALERT_EMAILS.verde
  });
});

// Configuración de nodemailer (Gmail para pruebas)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'jair.herrrera@gmail.com', // Cambia por tu correo de pruebas
    pass: 'qsrg adum qaby tigz' // Usa una contraseña de aplicación de Gmail
  }
});

// Función para enviar correo de alerta
function enviarCorreoAlerta({ nivel, descripcion, latitud, longitud, imagenUrl }) {
  const destinatarios = ALERT_EMAILS[nivel] || [];
  if (destinatarios.length === 0) return;
  const asunto = `ALERTA ${nivel.toUpperCase()} - Reporte de incidente UTEQ`;
  let cuerpo = `<b>Descripción:</b> ${descripcion || 'Sin descripción'}<br>`;
  cuerpo += `<b>Nivel:</b> ${nivel}<br>`;
  cuerpo += `<b>Ubicación:</b> <a href="https://www.google.com/maps?q=${latitud},${longitud}">${latitud},${longitud}</a><br>`;
  if (imagenUrl) {
    cuerpo += `<b>Imagen adjunta:</b> <a href="${imagenUrl}">Ver imagen</a><br>`;
  }
  cuerpo += `<br><i>Este correo fue generado automáticamente por el sistema de alertas UTEQ.</i>`;
  return transporter.sendMail({
    from: 'Alerta UTEQ <jair.herrrera@gmail.com>',
    to: destinatarios.join(','),
    subject: asunto,
    html: cuerpo
  });
}
const cors = require('cors');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');



app.use(cors());
app.use(express.json());

// Configuración de almacenamiento para imágenes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Servir archivos estáticos de la carpeta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'appusuarios'
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

// Nuevo endpoint para reportes con imagen
app.post('/reportes', upload.single('imagen'), async (req, res) => {
  console.log('BODY:', req.body);
  console.log('FILE:', req.file);
  const { descripcion, latitud, longitud, nivel } = req.body;
  let imagenUrl = null;
  if (req.file) {
    imagenUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  }

  if (!latitud || !longitud || !nivel) {
    return res.status(400).json({ message: 'Faltan datos: latitud, longitud y nivel son requeridos' });
  }

  const query = 'INSERT INTO reportes (descripcion, latitud, longitud, nivel, imagen) VALUES (?, ?, ?, ?, ?)';
  db.query(query, [descripcion, latitud, longitud, nivel, imagenUrl], async (err, result) => {
    if (err) {
      console.error('Error insertando reporte:', err);
      return res.status(500).json({ message: 'Error en la base de datos' });
    }
    // Enviar correo de alerta según nivel
    try {
      await enviarCorreoAlerta({ nivel, descripcion, latitud, longitud, imagenUrl });
    } catch (e) {
      console.error('Error enviando correo de alerta:', e);
    }
    res.status(201).json({ 
      message: 'Reporte creado correctamente',
      id: result.insertId,
      imagen: imagenUrl
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

