const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function runMigrations() {
  console.log('Running database migrations...');
  const migrationFile = path.join(__dirname, '001_create_users_and_otps.sql');
  const sql = fs.readFileSync(migrationFile, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migrations executed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
