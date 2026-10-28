import { Router } from 'express';
import { assincrono } from '../lib/http.js';
import { autenticar, somenteCoordenador } from '../middleware/auth.js';

// Relatorios gerais (somente coordenador).
export function rotasRelatorios({ db, auth }) {
  const r = Router();

  // GET /api/relatorios/resumo
  r.get('/resumo', autenticar({ db, auth }), somenteCoordenador, assincrono(async (req, res) => {
    const [totais, porTurma, porProfessor, disp, versoes, pendentes] = await Promise.all([
      db.query(`SELECT
          (SELECT count(*) FROM alunos) AS alunos,
          (SELECT count(*) FROM professores) AS professores,
          (SELECT count(*) FROM disciplinas) AS disciplinas,
          (SELECT count(*) FROM turmas) AS turmas,
          (SELECT count(*) FROM salas) AS salas`),
      db.query(`SELECT t.id AS turma_id, t.nome AS turma, t.turno, t.periodo_letivo,
                       COALESCE(sum(td.carga_semanal), 0)::int AS aulas_semanais
                  FROM turmas t LEFT JOIN turma_disciplinas td ON td.turma_id = t.id
                 GROUP BY t.id ORDER BY t.periodo_letivo DESC, t.nome`),
      db.query(`SELECT p.id AS professor_id, u.nome AS professor,
                       COALESCE(sum(td.carga_semanal), 0)::int AS aulas_semanais
                  FROM professores p JOIN usuarios u ON u.id = p.usuario_id
                  LEFT JOIN turma_disciplinas td ON td.professor_id = p.id
                 GROUP BY p.id, u.nome ORDER BY u.nome`),
      db.query(`SELECT p.id AS professor_id, u.nome AS professor, d.periodo_letivo,
                       round((sum(EXTRACT(EPOCH FROM (d.fim - d.inicio))) / 3600)::numeric, 2)::float8 AS horas_disponiveis
                  FROM disponibilidades d
                  JOIN professores p ON p.id = d.professor_id JOIN usuarios u ON u.id = p.usuario_id
                 WHERE d.status = 'aprovada'
                 GROUP BY p.id, u.nome, d.periodo_letivo ORDER BY u.nome`),
      db.query(`SELECT periodo, status, count(*)::int AS quantidade FROM versoes_horario GROUP BY periodo, status ORDER BY periodo, status`),
      db.query(`SELECT count(*)::int AS quantidade FROM disponibilidades WHERE status = 'pendente'`),
    ]);
    res.json({
      totais: totais.rows[0],
      aulas_semanais_por_turma: porTurma.rows,
      aulas_semanais_por_professor: porProfessor.rows,
      horas_disponiveis_por_professor: disp.rows,
      versoes_por_status: versoes.rows,
      disponibilidades_pendentes: pendentes.rows[0].quantidade,
    });
  }));

  return r;
}
