const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',          // ou o usuário que você usa
  password: 'admin123ne', // coloque a senha do Workbench
  database: 'suporte_tecnico'
});

module.exports = pool;
