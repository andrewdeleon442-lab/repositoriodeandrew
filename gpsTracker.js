const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const path = require('path');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fasttrack',
  charset: 'utf8mb4',
  reconnect: true,
  acquireTimeout: 60000,
  connectTimeout: 60000,
  timeout: 60000
};

let conexion;

function inicializarBaseDatos() {
  conexion = mysql.createConnection(dbConfig);
  
  conexion.connect(err => {
    if (err) {
      console.error('Error conectando a MySQL:', err.message);
      console.log('Reintentando en 5 segundos...');
      setTimeout(inicializarBaseDatos, 5000);
      return;
    }
    console.log('Conectado a la base de datos MySQL');
    verificarTablas();
  });

  conexion.on('error', err => {
    console.error('Error de MySQL:', err.message);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log('Reconectando...');
      inicializarBaseDatos();
    }
  });
}

function verificarTablas() {
  const crearTablaSQL = `
    CREATE TABLE IF NOT EXISTS paquetes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(50) UNIQUE NOT NULL,
      lat DECIMAL(10,8) NOT NULL,
      lng DECIMAL(11,8) NOT NULL,
      estado ENUM('pendiente', 'en_transito', 'entregado') DEFAULT 'pendiente',
      descripcion TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
  
  conexion.query(crearTablaSQL, (err, results) => {
    if (err) {
      console.error('Error creando tabla:', err.message);
    } else {
      console.log('Tabla "paquetes" verificada/creada correctamente');
      insertarDatosEjemplo();
    }
  });
}

function insertarDatosEjemplo() {
  const datosEjemplo = [
    ['PKG001', 14.6349, -90.5069, 'en_transito', 'Documentos importantes'],
    ['PKG002', 14.6355, -90.5075, 'pendiente', 'Paquete electronico'],
    ['PKG003', 14.6360, -90.5080, 'entregado', 'Paquete de ropa']
  ];
  
  let insertsCompletados = 0;
  
  datosEjemplo.forEach(([codigo, lat, lng, estado, descripcion]) => {
    const sql = 'INSERT IGNORE INTO paquetes (codigo, lat, lng, estado, descripcion) VALUES (?, ?, ?, ?, ?)';
    conexion.query(sql, [codigo, lat, lng, estado, descripcion], (err) => {
      if (err && err.code !== 'ER_DUP_ENTRY') {
        console.error('Error insertando dato ejemplo:', err.message);
      }
      insertsCompletados++;
      if (insertsCompletados === datosEjemplo.length) {
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
  conexion.query(sql, (err, results) => {
    if (err) {
      console.error('Error obteniendo paquetes:', err.message);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(results);
  });
});

app.get('/paquete/:codigo', (req, res) => {
  const { codigo } = req.params;
  const sql = 'SELECT * FROM paquetes WHERE codigo = ?';
  
  conexion.query(sql, [codigo], (err, results) => {
    if (err) {
      console.error('Error en consulta:', err.message);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    
    res.json(results[0]);
  });
});

app.post('/paquete', (req, res) => {
  const { codigo, lat, lng, descripcion } = req.body;
  
  if (!codigo || !lat || !lng) {
    return res.status(400).json({ error: 'Codigo, latitud y longitud son obligatorios' });
  }

  const sql = 'INSERT INTO paquetes (codigo, lat, lng, descripcion) VALUES (?, ?, ?, ?)';
  
  conexion.query(sql, [codigo, lat, lng, descripcion || ''], (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'El codigo ya existe' });
      }
      console.error('Error insertando:', err.message);
      return res.status(500).json({ error: 'Error al guardar paquete' });
    }
    
    res.json({ 
      mensaje: 'Paquete agregado correctamente', 
      id: results.insertId 
    });
  });
});

app.put('/paquete/:codigo', (req, res) => {
  const { codigo } = req.params;
  const { lat, lng, estado } = req.body;
  
  const sql = 'UPDATE paquetes SET lat = ?, lng = ?, estado = ? WHERE codigo = ?';
  
  conexion.query(sql, [lat, lng, estado || 'en_transito', codigo], (err, results) => {
    if (err) {
      console.error('Error actualizando:', err.message);
      return res.status(500).json({ error: 'Error al actualizar' });
    }
    
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    
    res.json({ mensaje: 'Ubicacion actualizada correctamente' });
  });
});

app.delete('/paquete/:codigo', (req, res) => {
  const { codigo } = req.params;
  
  const sql = 'DELETE FROM paquetes WHERE codigo = ?';
  
  conexion.query(sql, [codigo], (err, results) => {
    if (err) {
      console.error('Error eliminando:', err.message);
      return res.status(500).json({ error: 'Error al eliminar' });
    }
    
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    
    res.json({ mensaje: 'Paquete eliminado correctamente' });
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

inicializarBaseDatos();

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('FASTTRACK PRO - SERVIDOR DE PRODUCCION');
  console.log('='.repeat(50));
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Iniciado: ${new Date().toLocaleString()}`);
  console.log('Entorno: ' + (process.env.NODE_ENV || 'development'));
  console.log('='.repeat(50));
});

process.on('SIGTERM', () => {
  console.log('Recibió SIGTERM, cerrando servidor gracefully...');
  if (conexion) {
    conexion.end();
    console.log('Conexión a BD cerrada');
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rechazada no manejada:', reason);
});
