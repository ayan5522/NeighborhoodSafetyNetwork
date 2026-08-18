const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔄 Checking database connection and initializing schema_migrations table...');
    
    // Create migrations tracker table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: appliedRows } = await client.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(appliedRows.map(r => r.filename));

    const files = fs.readdirSync(__dirname)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${files.length} migration file(s).`);

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`⏭️  Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`🚀 Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');

      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');

      console.log(`✅ Successfully applied migration: ${file}`);
    }

    console.log('🎉 All migrations completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration error:', err.message);
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
