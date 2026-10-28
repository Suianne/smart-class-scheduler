import 'dotenv/config';

const env = process.env;

export const config = {
  nodeEnv: env.NODE_ENV || 'development',
  port: Number(env.PORT) || 3000,
  databaseUrl: env.DATABASE_URL,
  supabaseUrl: env.SUPABASE_URL,
  supabaseAnonKey: env.SUPABASE_ANON_KEY,
  // Chave administrativa: usada SOMENTE no backend. Nunca expor no frontend.
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  // Origens permitidas no CORS, separadas por virgula (URL do frontend na Vercel).
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export function exigirVariaveis(nomes) {
  const faltando = nomes.filter((n) => !env[n]);
  if (faltando.length) {
    throw new Error(`Variaveis de ambiente ausentes: ${faltando.join(', ')}`);
  }
}
