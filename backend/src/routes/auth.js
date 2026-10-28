import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { HttpError, assincrono } from '../lib/http.js';
import { validarCorpo } from '../middleware/validar.js';
import { autenticar } from '../middleware/auth.js';

export function rotasAuth({ db, auth }) {
  const r = Router();

  // Limite especifico para tentativas de login (forca bruta).
  const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' },
  });

  const schemaLogin = z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    senha: z.string().min(1).max(200),
  });

  async function perfilPorAuthId(authId) {
    const { rows } = await db.query(
      `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, p.id AS professor_id, a.id AS aluno_id, a.turma_id
         FROM usuarios u
         LEFT JOIN professores p ON p.usuario_id = u.id
         LEFT JOIN alunos a ON a.usuario_id = u.id
        WHERE u.auth_id = $1`,
      [authId],
    );
    const u = rows[0];
    if (!u || !u.ativo) return null;
    return {
      id: u.id, nome: u.nome, email: u.email, perfil: u.perfil,
      professor_id: u.professor_id, aluno_id: u.aluno_id, turma_id: u.turma_id,
    };
  }

  // POST /api/auth/login
  r.post('/login', limiteLogin, validarCorpo(schemaLogin), assincrono(async (req, res) => {
    const resultado = await auth.entrar(req.body.email, req.body.senha);
    // Mesma mensagem para qualquer falha, para nao revelar se o e-mail existe.
    if (!resultado) throw new HttpError(401, 'E-mail ou senha invalidos.');
    const usuario = await perfilPorAuthId(resultado.authId);
    if (!usuario) throw new HttpError(403, 'Conta sem perfil ativo no sistema.');
    res.json({ sessao: resultado.sessao, usuario });
  }));

  // POST /api/auth/refresh
  r.post('/refresh', limiteLogin,
    validarCorpo(z.object({ refresh_token: z.string().min(10).max(500) })),
    assincrono(async (req, res) => {
      const resultado = await auth.renovar(req.body.refresh_token);
      if (!resultado) throw new HttpError(401, 'Sessao expirada. Faca login novamente.');
      res.json({ sessao: resultado.sessao });
    }));

  // GET /api/auth/me
  r.get('/me', autenticar({ db, auth }), (req, res) => {
    const u = req.user;
    res.json({
      id: u.id, nome: u.nome, email: u.email, perfil: u.perfil,
      professor_id: u.professorId, aluno_id: u.alunoId, turma_id: u.turmaId,
    });
  });

  return r;
}
