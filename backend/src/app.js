import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { rotasAuth } from './routes/auth.js';
import { rotasRecursos } from './routes/recursos.js';
import { rotasPessoas } from './routes/pessoas.js';
import { rotasDisponibilidades } from './routes/disponibilidades.js';
import { rotasHorarios } from './routes/horarios.js';
import { rotasRelatorios } from './routes/relatorios.js';
import { rotaNaoEncontrada, tratarErros } from './middleware/errors.js';

// Monta a aplicacao com dependencias injetadas (db e auth), o que permite
// testar sem Supabase. `corsOrigins` e `limite` podem ser sobrescritos nos testes.
export function criarApp({ db, auth, corsOrigins = config.corsOrigins, limite = 300 }) {
  const app = express();
  const deps = { db, auth };

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render atras de proxy: necessario para o rate limit por IP
  app.use(helmet());
  app.use(cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(rateLimit({ windowMs: 60 * 1000, limit: limite, standardHeaders: true, legacyHeaders: false,
    message: { erro: 'Muitas requisicoes. Aguarde um instante.' } }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', rotasAuth(deps));
  app.use('/api/disponibilidades', rotasDisponibilidades(deps));
  app.use('/api/horarios', rotasHorarios(deps));
  app.use('/api/relatorios', rotasRelatorios(deps));
  app.use('/api', rotasPessoas(deps));
  app.use('/api', rotasRecursos(deps));

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}
