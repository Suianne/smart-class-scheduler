import pg from 'pg';
import { config } from './config.js';
import { OID, paraNumero, paraTexto, paraHoraMinuto } from './lib/tipos.js';

pg.types.setTypeParser(OID.INT8, paraNumero);
pg.types.setTypeParser(OID.DATE, paraTexto);
pg.types.setTypeParser(OID.TIME, paraHoraMinuto);

export function criarDbPg(connectionString = config.databaseUrl) {
  const pool = new pg.Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false'
      ? false
      : { rejectUnauthorized: false },

    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error(
      '[PostgreSQL] Erro em conexão ociosa:',
      err.message
    );
  });

  return {
    query: (text, params) => pool.query(text, params),

    async transaction(fn) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const result = await fn({
          query: (t, p) => client.query(t, p),
        });

        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },

    end: () => pool.end(),
  };
}
