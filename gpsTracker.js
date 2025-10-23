const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/fasttrack.db' 
  : './fasttrack.db';

console.log('Ruta de la base de datos:', dbPath);

let db;

function inicializarBaseDatos() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error abriendo SQLite:', err.message);
      return;
    }
    console.log('Conectado a SQLite en:', dbPath);
    crearTablas();
  });

  db.on('error', (err) => {
    console.error('Error de SQLite:', err.message);
  });
}

function crearTablas() {
  const crearTablaSQL = `
    CREATE TABLE IF NOT EXISTS paquetes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      estado TEXT DEFAULT 'pendiente',
      descripcion TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.run(crearTablaSQL, (err) => {
    if (err) {
      console.error('Error creando tabla:', err.message);
    } else {
      console.log('Tabla "paquetes" verificada');
      insertarDatosEjemplo();
    }
  });
}

function insertarDatosEjemplo() {
  const datos = [
    ['PKG001', 14.6349, -90.5069, 'en_transito', 'Documentos importantes'],
    ['PKG002', 14.6355, -90.5075, 'pendiente', 'Paquete electrónico'],
    ['PKG003', 14.6360, -90.5080, 'entregado', 'Paquete de ropa']
  ];

  let inserts = 0;
  datos.forEach(([codigo, lat, lng, estado, descripcion]) => {
    const sql = `INSERT OR IGNORE INTO paquetes (codigo, lat, lng, estado, descripcion) 
                 VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [codigo, lat, lng, estado, descripcion], function(err) {
      if (err && err.code !== 'SQLITE_CONSTRAINT') {
        console.error('Error insertando dato:', err.message);
      }
      inserts++;
      if (inserts === datos.length) {
        console.log('Datos de ejemplo verificados');
      }
    });
  });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/user.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'user.html'));
});

app.get('/paquetes', (req, res) => {
  const sql = 'SELECT * FROM paquetes ORDER BY timestamp DESC';
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error obteniendo paquetes:', err.message);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(rows);
  });
});

app.get('/paquete/:codigo', (req, res) => {
  const { codigo } = req.params;
  const sql = 'SELECT * FROM paquetes WHERE codigo = ?';
  
  db.get(sql, [codigo], (err, row) => {
    if (err) {
      console.error('Error en consulta:', err.message);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    
    res.json(row);
  });
});

app.post('/paquete', (req, res) => {
  const { codigo, lat, lng, descripcion } = req.body;
  
  if (!codigo || !lat || !lng) {
    return res.status(400).json({ error: 'Código, latitud y longitud son obligatorios' });
  }

  const sql = 'INSERT INTO paquetes (codigo, lat, lng, descripcion) VALUES (?, ?, ?, ?)';
  
  db.run(sql, [codigo, lat, lng, descripcion || ''], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'El código ya existe' });
      }
      console.error('Error insertando:', err.message);
      return res.status(500).json({ error: 'Error al guardar paquete' });
    }
    
    res.json({ 
      mensaje: 'Paquete agregado correctamente', 
      id: this.lastID 
    });
  });
});

app.put('/paquete/:codigo', (req, res) => {
  const { codigo } = req.params;
  const { lat, lng, estado } = req.body;
  
  const sql = 'UPDATE paquetes SET lat = ?, lng = ?, estado = ? WHERE codigo = ?';
  
  db.run(sql, [lat, lng, estado || 'en_transito', codigo], function(err) {
    if (err) {
      console.error('Error actualizando:', err.message);
      return res.status(500).json({ error: 'Error al actualizar' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    
    res.json({ mensaje: 'Ubicación actualizada correctamente' });
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: 'SQLite', 
    timestamp: new Date().toISOString() 
  });
});

const PORT = process.env.PORT || 3000;

inicializarBaseDatos();

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('FASTTRACK PRO - SQLite + Render.com');
  console.log('='.repeat(50));
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Base de datos: ${dbPath}`);
  console.log(`Iniciado: ${new Date().toLocaleString()}`);
  console.log('='.repeat(50));
});
