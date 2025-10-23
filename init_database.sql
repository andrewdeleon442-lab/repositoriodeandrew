DROP DATABASE IF EXISTS fasttrack;
CREATE DATABASE fasttrack;
USE fasttrack;

CREATE TABLE IF NOT EXISTS paquetes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  estado ENUM('pendiente', 'en_transito', 'entregado') DEFAULT 'pendiente',
  descripcion TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO paquetes (codigo, lat, lng, estado, descripcion) VALUES
('PKG001', 14.6349, -90.5069, 'en_transito', 'Paquete de documentos importantes'),
('PKG002', 14.6355, -90.5075, 'pendiente', 'Paquete electronico'),
('PKG003', 14.6360, -90.5080, 'entregado', 'Paquete de ropa');

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol ENUM('admin', 'user') DEFAULT 'user',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);