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
  const uniq = arr => Array.from(new Set(arr.filter(Boolean)));
  res.json({
    rojo: uniq(ALERT_EMAILS.rojo),
    amarillo: uniq(ALERT_EMAILS.amarillo),
    verde: uniq(ALERT_EMAILS.verde)
  });
});

// Configuración de nodemailer (Gmail SMTP explícito)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
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
// Carga flexible de bcrypt
let bcrypt;
try {
  bcrypt = require('bcryptjs');
  console.log('[auth] Usando bcryptjs');
} catch (e) {
  try {
    bcrypt = require('bcrypt');
    console.log('[auth] Usando bcrypt nativo');
  } catch (e2) {
    console.error('No se encontró ni bcryptjs ni bcrypt. Instala con: npm install bcryptjs');
    process.exit(1);
  }
}
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const sharp = require('sharp');
const fs = require('fs');

// Config
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const TOKEN_EXP = '8h';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@uteq.local';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123!';

// Rate limiters
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 50 });
const reportLimiter = rateLimit({ windowMs: 60*1000, max: 10 });

// Middleware auth
function auth(req,res,next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')? header.slice(7): null;
  if(!token) return res.status(401).json({message:'Token requerido'});
  try{ const payload = jwt.verify(token, JWT_SECRET); req.user = payload; next(); }catch{ return res.status(401).json({message:'Token inválido'}); }
}

function requireSuperAdmin(req,res,next){
  if(!req.user || req.user.rol !== 'superadmin') return res.status(403).json({message:'Requiere superadmin'});
  next();
}

// Sanitizador simple
function clean(str){ if(typeof str!=='string') return str; return str.replace(/[<>]/g,'').trim(); }



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
  // Auto-migraciones mínimas para compatibilidad
  const ensureColumn = (table, colName, colDef) => {
    db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [colName], (e, results) => {
      if (e) { console.warn('No se pudo verificar columna', table, colName, e.code); return; }
      if (results.length === 0) {
        console.log(`[migracion] Agregando columna ${colName} a ${table}`);
        db.query(`ALTER TABLE ${table} ADD COLUMN ${colDef}`, (e2) => {
          if (e2) console.error(`[migracion] Error agregando ${colName}:`, e2.code, e2.sqlMessage);
          else console.log(`[migracion] Columna ${colName} creada`);
        });
      }
    });
  };
  ensureColumn('usuarios','rol',"rol VARCHAR(20) NOT NULL DEFAULT 'reporter'");
  ensureColumn('usuarios','avatar','avatar VARCHAR(255) NULL');
  // Columnas para asociar reportes a un usuario
  ensureColumn('reportes','usuario_correo','usuario_correo VARCHAR(255) NULL');
  ensureColumn('reportes','usuario_nombre','usuario_nombre VARCHAR(255) NULL');
  // Crear superadmin si no existe
  db.query('SELECT correo FROM usuarios WHERE correo = ? LIMIT 1',[SUPER_ADMIN_EMAIL], async (e,r)=>{
    if(e){ console.error('Error verificando superadmin', e.code); return; }
    if(r.length===0){
      try{ const hash = await bcrypt.hash(SUPER_ADMIN_PASSWORD,10); db.query('INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES (?,?,?,?)',[ 'Super Administrador', SUPER_ADMIN_EMAIL, hash, 'superadmin' ], err2=>{ if(err2) console.error('No se pudo crear superadmin', err2.code); else console.log('[seed] Superadmin creado'); }); }catch{}
    } else { console.log('[seed] Superadmin ya existe'); }
    // Auto-seed reportes si hay muy pocos (para demo) - ejecuta una sola vez si base casi vacía
    db.query('SELECT COUNT(*) AS c FROM reportes', (errC, rowsC)=>{
      if(errC){ console.warn('No se pudo contar reportes para seed'); return; }
      const count = rowsC[0]?.c || 0;
      if(count < 8){
        console.log('[seed] Generando reportes de muestra...');
        const start = new Date('2025-06-01T00:00:00');
        const end = new Date();
        const niveles = ['rojo','amarillo','verde'];
        const inserts = [];
        const max = 28;
        const totalDias = Math.ceil((end - start)/86400000)+1;
        for(let i=0;i<totalDias;i++){
          if(inserts.length>=max) break;
            const day = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
            if(Math.random() < 0.38){
              const hora = Math.floor(Math.random()*24);
              const min = Math.floor(Math.random()*60);
              const fecha = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hora, min, Math.floor(Math.random()*60));
              const nivel = niveles[Math.floor(Math.random()*niveles.length)];
              const latBase = 20.592561; const lonBase = -100.392411;
              const lat = (latBase + (Math.random()-0.5)*0.004).toFixed(6);
              const lon = (lonBase + (Math.random()-0.5)*0.004).toFixed(6);
              const descripcion = `Seed ${nivel} ${inserts.length+1}`;
              inserts.push([descripcion, lat, lon, nivel, null, SUPER_ADMIN_EMAIL, 'Super Administrador', fecha]);
            }
        }
        if(inserts.length){
          db.query('INSERT INTO reportes (descripcion, latitud, longitud, nivel, imagen, usuario_correo, usuario_nombre, fecha) VALUES ?',[inserts], (e2)=>{
            if(e2) console.error('[seed] Error insertando reportes demo', e2.code);
            else console.log(`[seed] Insertados ${inserts.length} reportes demo`);
          });
        }
      }
    });
  });
});

// Ruta para registrar usuario
app.post('/register', authLimiter, async (req, res) => {
  const { nombre, correo, contrasena, rol } = req.body;
  if (!nombre || !correo || !contrasena) return res.status(400).json({ message: 'Faltan datos' });
  const nombreC = clean(nombre); const correoC = clean(correo.toLowerCase());
  try {
    const hash = await bcrypt.hash(contrasena, 10);
    const userRole = ['admin','gestor','reporter'].includes(rol) ? rol : 'reporter';
    const query = 'INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES (?, ?, ?, ?)';
    db.query(query, [nombreC, correoC, hash, userRole], (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Correo ya registrado' });
        return res.status(500).json({ message: 'Error en la base de datos' });
      }
      const token = jwt.sign({ correo: correoC, rol: userRole }, JWT_SECRET, { expiresIn: TOKEN_EXP });
      res.status(201).json({ message: 'Usuario registrado correctamente', token, usuario:{ nombre: nombreC, correo: correoC, rol: userRole } });
    });
  } catch (e) { res.status(500).json({ message: 'Error procesando contraseña' }); }
});

// Login: ahora devuelve datos básicos del usuario
app.post('/login', authLimiter, (req, res) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) return res.status(400).json({ message: 'Faltan datos' });
  const correoC = clean(correo.toLowerCase());
  const query = 'SELECT nombre, correo, contrasena, rol FROM usuarios WHERE correo = ? LIMIT 1';
  db.query(query, [correoC], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Error en la base de datos' });
    if (results.length === 0) return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
    const user = results[0];
    const ok = await bcrypt.compare(contrasena, user.contrasena || '');
    if (!ok) return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
    delete user.contrasena;
    const token = jwt.sign({ correo: user.correo, rol: user.rol || 'reporter' }, JWT_SECRET, { expiresIn: TOKEN_EXP });
    res.json({ message: 'Login exitoso', token, usuario: { nombre: user.nombre, correo: user.correo, rol: user.rol || 'reporter' } });
  });
});

// Obtener un usuario por correo
app.get('/usuario/:correo', auth, (req, res) => {
  const { correo } = req.params;
  const query = 'SELECT nombre, correo, rol, avatar FROM usuarios WHERE correo = ? LIMIT 1';
  db.query(query, [correo], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error en la base de datos' });
    if (results.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(results[0]);
  });
});

// Actualizar datos (nombre y/o correo)
app.put('/usuario/:correo', auth, (req, res) => {
  const { correo } = req.params;
  const { nombre, nuevoCorreo, rol } = req.body;
  if (!nombre && !nuevoCorreo) return res.status(400).json({ message: 'Nada que actualizar' });
  // Construcción dinámica
  const fields = [];
  const values = [];
  if (nombre) { fields.push('nombre = ?'); values.push(nombre); }
  if (nuevoCorreo) { fields.push('correo = ?'); values.push(nuevoCorreo); }
  if (rol && ['admin','gestor','reporter'].includes(rol)) { fields.push('rol = ?'); values.push(rol); }
  values.push(correo);
  const query = `UPDATE usuarios SET ${fields.join(', ')} WHERE correo = ?`;
  db.query(query, values, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Correo ya registrado' });
      return res.status(500).json({ message: 'Error en la base de datos' });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (nombre) {
      // Actualizar nombre en reportes vinculados (usuario_correo no cambia, solo nombre)
      const targetCorreo = nuevoCorreo || correo;
      db.query('UPDATE reportes SET usuario_nombre = ? WHERE usuario_correo = ?', [nombre, targetCorreo], ()=>{});
    }
    res.json({ message: 'Actualizado correctamente' });
  });
});

// Administración de usuarios (solo superadmin)
app.post('/admin/usuarios', auth, requireSuperAdmin, async (req,res)=>{
  const { nombre, correo, contrasena, rol } = req.body;
  if(!nombre || !correo || !contrasena || !rol) return res.status(400).json({message:'Faltan datos'});
  if(!['admin','gestor','reporter','superadmin'].includes(rol)) return res.status(400).json({message:'Rol inválido'});
  try {
    const hash = await bcrypt.hash(contrasena,10);
    db.query('INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES (?,?,?,?)',[clean(nombre), clean(correo.toLowerCase()), hash, rol], (err)=>{
      if(err){ if(err.code==='ER_DUP_ENTRY') return res.status(409).json({message:'Correo ya existe'}); return res.status(500).json({message:'Error BD'});} 
      return res.status(201).json({message:'Usuario creado', usuario:{ nombre, correo: correo.toLowerCase(), rol }});
    });
  } catch { return res.status(500).json({message:'Error procesando contraseña'}); }
});
app.patch('/admin/usuarios/:correo/rol', auth, requireSuperAdmin, (req,res)=>{
  const { correo } = req.params; const { rol } = req.body;
  if(!rol || !['admin','gestor','reporter','superadmin'].includes(rol)) return res.status(400).json({message:'Rol inválido'});
  if(correo.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return res.status(403).json({message:'No se puede cambiar rol del superadmin'});
  db.query('UPDATE usuarios SET rol = ? WHERE correo = ?',[rol, correo.toLowerCase()], (err,result)=>{
    if(err) return res.status(500).json({message:'Error BD'});
    if(result.affectedRows===0) return res.status(404).json({message:'Usuario no encontrado'});
    return res.json({message:'Rol actualizado'});
  });
});
app.get('/admin/usuarios', auth, requireSuperAdmin, (req,res)=>{
  let { search, page = 1, pageSize = 20 } = req.query;
  if(typeof search === 'string') search = search.trim(); else search = '';
  const p = Math.max(1, parseInt(page));
  const ps = Math.min(100, Math.max(1, parseInt(pageSize)));
  let base = 'FROM usuarios';
  const whereParts = [];
  const params = [];
  if (search) { const s = search.toLowerCase(); whereParts.push('(LOWER(nombre) LIKE ? OR LOWER(correo) LIKE ?)'); params.push(`%${s}%`,`%${s}%`); }
  const whereSql = whereParts.length? ' WHERE '+ whereParts.join(' AND '): '';
  const sqlData = `SELECT nombre, correo, rol, avatar ${base}${whereSql} ORDER BY nombre ASC LIMIT ? OFFSET ?`;
  const sqlCount = `SELECT COUNT(*) AS total ${base}${whereSql}`;
  db.query(sqlCount, params, (errCount, countRows)=>{
    if(errCount) return res.status(500).json({message:'Error BD'});
    const total = countRows[0].total;
    const offset = (p-1)*ps;
    db.query(sqlData, [...params, ps, offset], (errData, rows)=>{
      if(errData) return res.status(500).json({message:'Error BD'});
      res.json({ items: rows, total, page: p, pageSize: ps, totalPages: Math.ceil(total/ps) });
    });
  });
});
app.delete('/admin/usuarios/:correo', auth, requireSuperAdmin, (req,res)=>{
  const { correo } = req.params;
  if (correo.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return res.status(403).json({message:'No se puede eliminar superadmin'});
  db.query('DELETE FROM usuarios WHERE correo = ?',[correo.toLowerCase()], (err,result)=>{
    if(err) return res.status(500).json({message:'Error BD'});
    if(result.affectedRows===0) return res.status(404).json({message:'Usuario no encontrado'});
    return res.json({message:'Usuario eliminado'});
  });
});

// Semilla de reportes de prueba (superadmin)
app.post('/admin/seed-reportes', auth, requireSuperAdmin, (req,res)=>{
  const { from='2025-06-01', to, max=35 } = req.body || {};
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  if(isNaN(start) || isNaN(end) || start > end) return res.status(400).json({message:'Rango de fechas inválido'});
  // Verificar si ya hay suficientes datos en el rango para no duplicar
  db.query('SELECT COUNT(*) AS c FROM reportes WHERE fecha BETWEEN ? AND ?', [start, end], (err, rows)=>{
    if(err) return res.status(500).json({message:'Error BD conteo'});
    if(rows[0].c >= max/2) return res.status(200).json({message:'Ya existen datos en el rango, no se generaron nuevos', existentes: rows[0].c});
    const totalDias = Math.ceil((end - start)/86400000)+1;
    const niveles = ['rojo','amarillo','verde'];
    const inserts = [];
    // Generar fechas dispersas (no todos los días)
    for(let i=0;i<totalDias;i++){
      const dayDate = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
      // Probabilidad ~40% de crear un reporte ese día
      if(Math.random() < 0.4 && inserts.length < max){
        const hora = Math.floor(Math.random()*24);
        const minuto = Math.floor(Math.random()*60);
        const fecha = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hora, minuto, Math.floor(Math.random()*60));
        const nivel = niveles[Math.floor(Math.random()*niveles.length)];
        const latBase = 20.592561; const lonBase = -100.392411;
        const lat = (latBase + (Math.random()-0.5)*0.004).toFixed(6);
        const lon = (lonBase + (Math.random()-0.5)*0.004).toFixed(6);
        const descripcion = `Evento ${nivel} simulado ${inserts.length+1}`;
        inserts.push([descripcion, lat, lon, nivel, null, SUPER_ADMIN_EMAIL, 'Super Administrador', fecha]);
      }
      if(inserts.length>=max) break;
    }
    if(!inserts.length) return res.status(200).json({message:'Nada que insertar (azar)', generados:0});
    const sql = 'INSERT INTO reportes (descripcion, latitud, longitud, nivel, imagen, usuario_correo, usuario_nombre, fecha) VALUES ?';
    db.query(sql, [inserts], (e2)=>{
      if(e2) return res.status(500).json({message:'Error insertando', error:e2.code});
      return res.status(201).json({message:'Reportes de prueba generados', generados: inserts.length});
    });
  });
});

// Cambiar contraseña
app.post('/usuario/:correo/password', auth, (req, res) => {
  const { correo } = req.params; const { actual, nueva } = req.body;
  if (!actual || !nueva) return res.status(400).json({ message: 'Faltan datos' });
  const select = 'SELECT contrasena FROM usuarios WHERE correo = ? LIMIT 1';
  db.query(select, [correo], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Error en la base de datos' });
    if (results.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
    const ok = await bcrypt.compare(actual, results[0].contrasena || '');
    if (!ok) return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    try {
      const hash = await bcrypt.hash(nueva, 10);
      const update = 'UPDATE usuarios SET contrasena = ? WHERE correo = ?';
      db.query(update, [hash, correo], (err2) => { if (err2) return res.status(500).json({ message: 'Error en la base de datos' }); res.json({ message: 'Contraseña actualizada' }); });
    } catch { return res.status(500).json({ message: 'Error procesando contraseña' }); }
  });
});

// Nuevo endpoint para reportes con imagen
app.post('/reportes', auth, reportLimiter, upload.single('imagen'), async (req, res) => {
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

  const query = 'INSERT INTO reportes (descripcion, latitud, longitud, nivel, imagen, usuario_correo, usuario_nombre) VALUES (?, ?, ?, ?, ?, ?, ?)';
  db.query(query, [descripcion, latitud, longitud, nivel, imagenUrl, req.user?.correo || null, req.user?.correo || null], async (err, result) => {
    if (err) {
      console.error('Error insertando reporte:', err);
      return res.status(500).json({ message: 'Error en la base de datos' });
    }
    // Enviar correo de alerta según nivel
    try {
      console.log('[ALERTA] Intentando enviar correo:', { nivel, descripcion, latitud, longitud, imagenUrl });
      const mailResult = await enviarCorreoAlerta({ nivel, descripcion, latitud, longitud, imagenUrl });
      console.log('[ALERTA] Resultado de enviarCorreoAlerta:', mailResult);
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
app.get('/reportes', auth, (req, res) => {
  const query = 'SELECT id, descripcion, latitud, longitud, nivel, imagen, fecha, usuario_correo, usuario_nombre FROM reportes ORDER BY fecha DESC';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error obteniendo reportes:', err);
      return res.status(500).json({ message: 'Error en la base de datos' });
    }
    res.json(results);
  });
});

// Ruta para obtener un reporte específico por ID
app.get('/reportes/:id', auth, (req, res) => {
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
app.delete('/reportes/:id', auth, (req, res) => {
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


// ================== AVATAR UPLOAD (reubicado fuera de delete) ==================
const avatarUpload = multer({ storage: multer.memoryStorage(), limits:{ fileSize: 2*1024*1024 } });

// Asegurar carpeta avatars al iniciar
const avatarsBaseDir = path.join(__dirname,'uploads','avatars');
if(!fs.existsSync(avatarsBaseDir)) fs.mkdirSync(avatarsBaseDir, { recursive:true });

app.post('/usuario/:correo/avatar', auth, avatarUpload.single('avatar'), async (req,res)=>{
  if (!req.file) return res.status(400).json({message:'Archivo requerido'});
  try {
    const correo = req.params.correo;
    const filename = `${Date.now()}-${Math.round(Math.random()*1e9)}.jpg`;
    const outPath = path.join(avatarsBaseDir, filename);
    await sharp(req.file.buffer).resize(256,256,{fit:'cover'}).jpeg({quality:80}).toFile(outPath);
    const publicUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${filename}`;
    // Intentar guardar en DB; si la columna no existe, continuar sin fallar
    db.query('UPDATE usuarios SET avatar = ? WHERE correo = ?', [publicUrl, correo], (err)=>{
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        console.warn('Columna avatar no existe, considerar ALTER TABLE para agregarla.');
      }
    });
    return res.status(201).json({ message:'Avatar actualizado', avatar: publicUrl });
  } catch(e){
    console.error('Error avatar:', e);
    return res.status(500).json({message:'Error procesando imagen'});
  }
});

app.use('/uploads/avatars', express.static(avatarsBaseDir));
// ===============================================================================


app.listen(3000, '0.0.0.0', () => {
  console.log('Servidor corriendo en http://0.0.0.0:3000');
});

