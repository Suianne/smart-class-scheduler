import { HttpError, assincrono, proibido } from '../lib/http.js';

// Autentica a requisicao: valida o token (Supabase Auth) e carrega o perfil do
// banco. O perfil NUNCA vem do token nem do corpo da requisicao, apenas da tabela usuarios.
export function autenticar({ db, auth }) {
  return assincrono(async (req, res, next) => {
    const cabecalho = req.headers.authorization || '';
    const [tipo, token] = cabecalho.split(' ');
    if (tipo !== 'Bearer' || !token) {
      throw new HttpError(401, 'Token de acesso ausente.');
    }

    const identidade = await auth.verificarToken(token);
    if (!identidade) throw new HttpError(401, 'Token invalido ou expirado.');

    const { rows } = await db.query(
      `SELECT u.id, u.nome, u.email, u.perfil, u.ativo,
              p.id AS professor_id, a.id AS aluno_id, a.turma_id
         FROM usuarios u
         LEFT JOIN professores p ON p.usuario_id = u.id
         LEFT JOIN alunos a      ON a.usuario_id = u.id
        WHERE u.auth_id = $1`,
      [identidade.authId],
    );
    const u = rows[0];
    if (!u) throw proibido('Conta sem perfil cadastrado no sistema.');
    if (!u.ativo) throw proibido('Conta desativada.');

    req.user = {
      id: Number(u.id),
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      professorId: u.professor_id == null ? null : Number(u.professor_id),
      alunoId: u.aluno_id == null ? null : Number(u.aluno_id),
      turmaId: u.turma_id == null ? null : Number(u.turma_id),
    };
    next();
  });
}

// Restringe a rota aos perfis informados. Deve vir depois de autenticar().
export function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.user || !perfis.includes(req.user.perfil)) {
      return next(proibido());
    }
    next();
  };
}

export const somenteCoordenador = exigirPerfil('coordenador');
