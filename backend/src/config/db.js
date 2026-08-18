const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

/**
 * Execute a parameterized query against the connection pool.
 * @param {string} text - SQL query with $1, $2 placeholders
 * @param {Array} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (env.NODE_ENV === 'development') {
    // Only log query duration in debug mode, never params that could contain passwords
    // console.debug('Executed query', { text: text.substring(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Acquire a client from the pool for multi-query transaction handling.
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query;
  const originalRelease = client.release;

  // Set timeout to prevent leaked clients
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease.apply(client);
  };

  return client;
}

/**
 * Check database connectivity health.
 */
async function testConnection() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW() as current_time, version()');
    return { ok: true, timestamp: res.rows[0].current_time };
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
};
