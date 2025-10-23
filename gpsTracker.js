const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

const dbPath = process.env.NODE_ENV === 'production' 
  ? '/tmp/fasttrack.db'
  : './fasttrack.db';

console.log('Ruta de BD:', dbPath);

let db;

function inicializarBaseDatos() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error con SQLite:', err.message);
      return;
    }
    console.log('Conectado a SQLite');
    crearTablas();
  });
}

function crearTablas() {
  const sql = `
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
  
  db.run(sql, (err) => {
    if (err) {
      console.error('❌ Error creando tabla:', err);
    } else {
      console.log('Tabla paquetes lista');
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

  datos.forEach(([codigo, lat, lng, estado, descripcion]) => {
    db.run(
      `INSERT OR IGNORE INTO paquetes (codigo, lat, lng, estado, descripcion) VALUES (?, ?, ?, ?, ?)`,
      [codigo, lat, lng, estado, descripcion],
      (err) => {
        if (err) console.log('Datos insertados');
      }
    );
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
  db.all('SELECT * FROM paquetes ORDER BY timestamp DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(rows);
  });
});

app.get('/paquete/:codigo', (req, res) => {
  const { codigo } = req.params;
  db.get('SELECT * FROM paquetes WHERE codigo = ?', [codigo], (err, row) => {
    if (err) {
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
    return res.status(400).json({ error: 'Código, lat y lng son obligatorios' });
  }

  db.run(
    'INSERT INTO paquetes (codigo, lat, lng, descripcion) VALUES (?, ?, ?, ?)',
    [codigo, lat, lng, descripcion || ''],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'El código ya existe' });
        }
        return res.status(500).json({ error: 'Error al guardar' });
      }
      res.json({ mensaje: 'Paquete agregado', id: this.lastID });
    }
  );
});

const PORT = process.env.PORT || 10000;

inicializarBaseDatos();

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('FASTTRACK PRO - SQLITE EN RENDER');
  console.log('='.repeat(50));
  console.log(`URL: http://localhost:${PORT}`);
  console.log('Base de datos: SQLite');
  console.log('='.repeat(50));
});