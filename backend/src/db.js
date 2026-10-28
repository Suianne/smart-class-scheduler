import pg from 'pg';
import { config } from './config.js';
import { OID, paraNumero, paraTexto, paraHoraMinuto } from './lib/tipos.js';

pg.types.setTypeParser(OID.INT8, paraNumero);
pg.types.setTypeParser(OID.DATE, paraTexto);
pg.types.setTypeParser(OID.TIME, paraHoraMinuto);

// Interface do banco usada pelo restante da aplicacao:
//   db.query(texto, parametros)          -> { rows }
//   db.transaction(async (tx) => {...})  -> tx.query(texto, parametros)
// Os testes injetam uma implementacao com PGlite que segue o mesmo formato.

export function criarDbPg(connectionString = config.databaseUrl) {
  const pool = new pg.Pool({
    connectionString,
    // O Supabase exige TLS. Em ambiente local sem TLS, defina DATABASE_SSL=false.
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 10,
  });

  return {
    query: (text, params) => pool.query(text, params),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (t, p) => client.query(t, p) });
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
