const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

const dbPath = './fasttrack.db';
console.log('Iniciando FastTrack PRO - Base de datos:', dbPath);

let db;

function inicializarBaseDatos() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        console.error('Error crítico con SQLite:', err.message);
        reject(err);
        return;
      }
      
      console.log('Conectado a SQLite');
    
      db.run('PRAGMA journal_mode = WAL;');
      db.run('PRAGMA synchronous = NORMAL;');
      db.run('PRAGMA cache_size = -64000;');
      
      crearTablas().then(resolve).catch(reject);
    });
  });
}

async function crearTablas() {
  return new Promise((resolve, reject) => {
    const tablasSQL = [
      `CREATE TABLE IF NOT EXISTS paquetes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        estado TEXT DEFAULT 'pendiente',
        descripcion TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS historial_movimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paquete_id INTEGER,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (paquete_id) REFERENCES paquetes (id)
      )`
    ];

    let tablasCreadas = 0;
    
    tablasSQL.forEach((sql, index) => {
      db.run(sql, (err) => {
        if (err) {
          console.error(`Error creando tabla ${index + 1}:`, err);
          reject(err);
          return;
        }
        
        tablasCreadas++;
        if (tablasCreadas === tablasSQL.length) {
          console.log('Todas las tablas verificadas');
          insertarDatosEjemplo().then(resolve).catch(reject);
        }
      });
    });
  });
}

async function insertarDatosEjemplo() {
  return new Promise((resolve) => {
    const datos = [
      ['PKG001', 14.6349, -90.5069, 'en_transito', 'Documentos legales importantes - Urgente'],
      ['PKG002', 14.6355, -90.5075, 'pendiente', 'Laptop Gaming - Garantía'],
      ['PKG003', 14.6360, -90.5080, 'entregado', 'Ropa deportiva - Pedido online'],
      ['PKG004', 14.6320, -90.5050, 'en_transito', 'Electrónicos - Frágil'],
      ['PKG005', 14.6380, -90.5100, 'pendiente', 'Regalo de cumpleaños']
    ];

    let inserts = 0;
    const total = datos.length;

    if (total === 0) {
      resolve();
      return;
    }

    datos.forEach(([codigo, lat, lng, estado, descripcion]) => {
   
      db.run(
        `INSERT OR IGNORE INTO paquetes (codigo, lat, lng, estado, descripcion) VALUES (?, ?, ?, ?, ?)`,
        [codigo, lat, lng, estado, descripcion],
        function(err) {
          if (err && !err.message.includes('UNIQUE')) {
            console.error('Error insertando paquete:', err);
          }
  
          if (this.changes > 0) {
            db.run(
              `INSERT INTO historial_movimientos (paquete_id, lat, lng) VALUES (?, ?, ?)`,
              [this.lastID, lat, lng]
            );
          }
          
          inserts++;
          if (inserts === total) {
            console.log(`${total} paquetes de ejemplo listos`);
            resolve();
          }
        }
      );
    });
  });
}

app.get('/health', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM paquetes', (err, row) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'SQLite',
      total_paquetes: row ? row.count : 0,
      environment: process.env.NODE_ENV || 'development'
    });
  });
});

app.get('/estadisticas', (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes,
      SUM(CASE WHEN estado = 'en_transito' THEN 1 ELSE 0 END) as en_transito,
      SUM(CASE WHEN estado = 'entregado' THEN 1 ELSE 0 END) as entregados
    FROM paquetes
  `;
  
  db.get(sql, (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
    res.json(row);
  });
});

app.get('/paquetes', (req, res) => {
  const sql = `
    SELECT *, 
           datetime(timestamp, 'localtime') as timestamp_local,
           datetime(ultima_actualizacion, 'localtime') as ultima_actualizacion_local
    FROM paquetes 
    ORDER BY timestamp DESC
  `;
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error en /paquetes:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    res.json(rows);
  });
});

app.get('/paquete/:codigo', (req, res) => {
  const { codigo } = req.params;
  
  const sql = `
    SELECT *, 
           datetime(timestamp, 'localtime') as timestamp_local,
           datetime(ultima_actualizacion, 'localtime') as ultima_actualizacion_local
    FROM paquetes 
    WHERE codigo = ?
  `;
  
  db.get(sql, [codigo], (err, row) => {
    if (err) {
      console.error('Error en /paquete:', err);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    
    db.all(
      'SELECT * FROM historial_movimientos WHERE paquete_id = ? ORDER BY timestamp DESC',
      [row.id],
      (err, historial) => {
        if (!err && historial) {
          row.historial = historial;
        }
        res.json(row);
      }
    );
  });
});

app.post('/paquete', (req, res) => {
  const { codigo, lat, lng, descripcion, estado } = req.body;
  
  if (!codigo || !lat || !lng) {
    return res.status(400).json({ error: 'Código, latitud y longitud son obligatorios' });
  }

  if (codigo.length > 50) {
    return res.status(400).json({ error: 'El código no puede tener más de 50 caracteres' });
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  
  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return res.status(400).json({ error: 'Latitud inválida' });
  }
  
  if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ error: 'Longitud inválida' });
  }

  const sql = `
    INSERT INTO paquetes (codigo, lat, lng, descripcion, estado) 
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [codigo, latNum, lngNum, descripcion || '', estado || 'pendiente'], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'El código ya existe' });
      }
      console.error('Error insertando paquete:', err);
      return res.status(500).json({ error: 'Error al guardar paquete' });
    }
    
    db.run(
      'INSERT INTO historial_movimientos (paquete_id, lat, lng) VALUES (?, ?, ?)',
      [this.lastID, latNum, lngNum]
    );
    
    res.json({ 
      success: true,
      mensaje: 'Paquete agregado correctamente', 
      id: this.lastID 
    });
  });
});

app.put('/paquete/:codigo', (req, res) => {
  const { codigo } = req.params;
  const { lat, lng, estado } = req.body;
  
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitud y longitud son obligatorias' });
  }

  const sql = `
    UPDATE paquetes 
    SET lat = ?, lng = ?, estado = ?, ultima_actualizacion = CURRENT_TIMESTAMP 
    WHERE codigo = ?
  `;
  
  db.run(sql, [lat, lng, estado || 'en_transito', codigo], function(err) {
    if (err) {
      console.error('Error actualizando:', err);
      return res.status(500).json({ error: 'Error al actualizar' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    
    db.get('SELECT id FROM paquetes WHERE codigo = ?', [codigo], (err, row) => {
      if (!err && row) {
        db.run(
          'INSERT INTO historial_movimientos (paquete_id, lat, lng) VALUES (?, ?, ?)',
          [row.id, lat, lng]
        );
      }
    });
    
    res.json({ success: true, mensaje: 'Ubicación actualizada correctamente' });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/user.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'user.html'));
});

const PORT = process.env.PORT || 10000;

inicializarBaseDatos()
  .then(() => {
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('FASTTRACK PRO - SISTEMA LOGÍSTICO PREMIUM');
      console.log('='.repeat(60));
      console.log(`Servidor: http://localhost:${PORT}`);
      console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Base de datos: ${dbPath}`);
      console.log(`Iniciado: ${new Date().toLocaleString()}`);
      console.log('='.repeat(60));
      console.log('Endpoints disponibles:');
      console.log('   GET  /health       - Estado del sistema');
      console.log('   GET  /estadisticas - Métricas del sistema');
      console.log('   GET  /paquetes     - Todos los paquetes');
      console.log('   GET  /paquete/:id  - Buscar paquete');
      console.log('   POST /paquete      - Crear paquete');
      console.log('   PUT  /paquete/:id  - Actualizar paquete');
      console.log('='.repeat(60) + '\n');
    });
  })
  .catch((err) => {
    console.error('\n NO SE PUDO INICIAR LA APLICACIÓN:', err.message);
    console.log(' Solución: Verifica los permisos de escritura en el directorio');
    process.exit(1);
  });

process.on('SIGTERM', () => {
  console.log('\n Recibió SIGTERM, cerrando servidor...');
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error cerrando BD:', err);
      } else {
        console.log('Base de datos cerrada');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
