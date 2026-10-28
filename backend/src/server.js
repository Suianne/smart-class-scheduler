import { config, exigirVariaveis } from './config.js';
import { criarDbPg } from './db.js';
import { criarAuthSupabase } from './supabase.js';
import { criarApp } from './app.js';

exigirVariaveis(['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);

const db = criarDbPg();
const auth = criarAuthSupabase();
const app = criarApp({ db, auth });

const servidor = app.listen(config.port, () => {
  console.log(`API SUCELSO TECH escutando na porta ${config.port} (${config.nodeEnv})`);
});

const encerrar = () => servidor.close(() => db.end().finally(() => process.exit(0)));
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
