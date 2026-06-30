#!/usr/bin/env node
/**
 * Apply database/schema.sql and database/seed.sql using DATABASE_URL from .env
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const root = path.join(__dirname, '..', '..');
const files = [
  path.join(root, 'database', 'schema.sql'),
  path.join(root, 'database', 'seed.sql'),
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and configure it.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    for (const file of files) {
      if (!fs.existsSync(file)) {
        throw new Error(`SQL file not found: ${file}`);
      }
      const sql = fs.readFileSync(file, 'utf8');
      console.log(`Running ${path.relative(root, file)}...`);
      await pool.query(sql);
      console.log('  OK');
    }
    console.log('Database setup complete.');
  } catch (err) {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
