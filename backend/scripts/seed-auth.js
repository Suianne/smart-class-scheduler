// Cria as contas do Supabase Auth para os usuarios de teste (tabela usuarios) e
// grava usuarios.auth_id. Execute depois de `npm run db:seed`. Pode ser repetido:
// contas que ja existem sao reaproveitadas.
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { config, exigirVariaveis } from '../src/config.js';

exigirVariaveis(['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SEED_PASSWORD']);
const senha = process.env.SEED_PASSWORD;
if (senha.length < 8) throw new Error('SEED_PASSWORD deve ter ao menos 8 caracteres.');

const admin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const client = new pg.Client({
  connectionString: config.databaseUrl,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});
await client.connect();

try {
  const { rows } = await client.query('SELECT id, email FROM usuarios WHERE auth_id IS NULL ORDER BY id');
  // Mapa de contas ja existentes no Auth (para repetir o script com seguranca)
  const existentes = new Map();
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    data.users.forEach((u) => existentes.set(u.email, u.id));
    if (data.users.length < 200) break;
  }

  for (const u of rows) {
    let authId = existentes.get(u.email);
    if (!authId) {
      const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: senha, email_confirm: true });
      if (error) throw new Error(`${u.email}: ${error.message}`);
      authId = data.user.id;
    }
    await client.query('UPDATE usuarios SET auth_id = $1 WHERE id = $2', [authId, u.id]);
    console.log('OK', u.email);
  }
  console.log(`Concluido: ${rows.length} conta(s) vinculada(s).`);
} finally {
  await client.end();
}
