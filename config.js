module.exports = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'andrew',
    password: process.env.DB_PASSWORD || 'password123',
    database: process.env.DB_NAME || 'fasttrack'
  },
  server: {
    port: process.env.PORT || 3000
  },
  security: {
    jwt_secret: process.env.JWT_SECRET || 'fasttrack_secret_key'
  }
};