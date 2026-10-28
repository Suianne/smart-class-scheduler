// Executa arquivos .sql no banco apontado por DATABASE_URL.
// Uso: node scripts/run-sql.js ../sql/01_schema.sql [outro.sql ...]
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { config, exigirVariaveis } from '../src/config.js';

exigirVariaveis(['DATABASE_URL']);
const arquivos = process.argv.slice(2);
if (!arquivos.length) {
  console.error('Informe ao menos um arquivo .sql');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: config.databaseUrl,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});
await client.connect();
try {
  for (const arq of arquivos) {
    await client.query(fs.readFileSync(path.resolve(arq), 'utf8'));
    console.log('Executado:', arq);
  }
} finally {
  await client.end();
}
