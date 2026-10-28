# Contrato da API REST

Base: `https://<api-no-render>/api`. Formato: JSON. Horários em `HH:MM`, datas em `AAAA-MM-DD`. Dias: `segunda`, `terca`, `quarta`, `quinta`, `sexta`, `sabado`.

Autenticação: cabeçalho `Authorization: Bearer <access_token>` em todas as rotas, exceto `/health`, `/auth/login` e `/auth/refresh`.

Formato de erro: `{ "erro": "mensagem" }`, com `detalhes` (campo e mensagem) nos erros de validação.

| Código | Uso |
|---|---|
| 200, 201, 204 | Sucesso, criado, sem conteúdo |
| 202 | Aceito: disponibilidade submetida ao coordenador, aguardando aprovação |
| 400 | Dados inválidos ou formato incorreto |
| 401 | Token ausente, inválido ou expirado |
| 403 | Perfil sem permissão, ou conta desativada |
| 404 | Recurso inexistente |
| 409 | Duplicidade, vínculo existente ou conflito de horário |
| 413 | Corpo da requisição acima de 100 kB |
| 429 | Limite de requisições excedido |

Legenda de acesso: **A** aluno, **P** professor, **C** coordenador.

## Parte 1 (implementada)

### Autenticação

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/health` | público | Verificação de disponibilidade. |
| POST | `/auth/login` | público | Corpo: `{ email, senha }`. Retorna `{ sessao: { access_token, refresh_token, expires_at }, usuario }`. |
| POST | `/auth/refresh` | público | Corpo: `{ refresh_token }`. Retorna nova `sessao`. |
| GET | `/auth/me` | A P C | Retorna `{ id, nome, email, perfil, professor_id, aluno_id, turma_id }`. |

### Consulta de horários

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/horarios/minha-turma` | A P C | Aluno: grade publicada da própria turma. Professor e coordenador: exigem `?turma_id=` (professor só nas turmas em que leciona). Coordenador aceita `?versao_id=`. |
| GET | `/horarios/professor` | P C | Professor: a própria grade. Coordenador: exige `?professor_id=` e aceita `?versao_id=`. Inclui `turmas_atribuidas`. |

Formato de resposta (aulas):

```json
{
  "turma": { "id": 1, "nome": "Turma A", "turno": "manha", "periodo_letivo": "2026.2" },
  "versao": { "id": 3, "periodo": "2026.2", "status": "publicada", "data": "...", "publicada_em": "..." },
  "aulas": [{
    "id": 10, "dia": "segunda", "inicio": "08:00", "fim": "09:00", "situacao": "agendada",
    "turma": { "id": 1, "nome": "Turma A" },
    "disciplina": { "id": 1, "nome": "Banco de Dados", "codigo": "BD01" },
    "professor": { "id": 1, "nome": "Ana Souza" },
    "sala": { "id": 1, "identificacao": "Sala 101" }
  }]
}
```

Sem versão publicada: `versao: null`, `aulas: []` e um campo `aviso`.

### Consulta de cadastros (todos os perfis autenticados)

`GET /disciplinas`, `/salas`, `/turmas`, `/turnos`, `/periodos-letivos` e `/turma-disciplinas`, cada uma também com `GET /<recurso>/:id`.
Filtros: `/turmas?periodo_letivo=&turno=` e `/turma-disciplinas?turma_id=&professor_id=&disciplina_id=`.

### Cadastros (somente C)

Para cada recurso acima: `POST /<recurso>`, `PUT /<recurso>/:id` (parcial, ao menos um campo) e `DELETE /<recurso>/:id`.

| Recurso | Campos |
|---|---|
| `disciplinas` | nome, codigo, carga_horaria |
| `salas` | identificacao, capacidade |
| `turmas` | nome, turno, periodo_letivo |
| `turnos` | nome, inicio, fim, intervalo_inicio, intervalo_fim, duracao_aula_min |
| `periodos-letivos` | codigo, data_inicio, data_fim, coleta_aberta |
| `turma-disciplinas` | turma_id, disciplina_id, professor_id, carga_semanal |

### Professores e alunos (somente C)

| Método | Rota | Corpo |
|---|---|---|
| GET | `/professores`, `/alunos`, e `/<recurso>/:id` | |
| POST | `/professores` | `{ nome, email, senha (mín. 8), matricula }` |
| POST | `/alunos` | `{ nome, email, senha, matricula, turma_id }` |
| PUT | `/professores/:id`, `/alunos/:id` | Parcial: nome, matricula, ativo (e turma_id para aluno) |
| DELETE | `/professores/:id`, `/alunos/:id` | Remove perfil, usuário e conta de acesso. 409 se houver vínculos. |

### Disponibilidades

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/disponibilidades` | P C | Professor: as próprias. Coordenador: todas, com filtros `professor_id`, `periodo_letivo` e `status`. |
| POST | `/disponibilidades` | P C | Corpo: `{ dia, inicio, fim, periodo_letivo? }`. Coordenador informa também `professor_id`. Sem `periodo_letivo`, usa o período com coleta aberta. Retorna 201 (vigente) ou 202 (pendente). |
| PUT | `/disponibilidades/:id` | P C | Corpo parcial: `dia`, `inicio`, `fim`. Retorna 200 (alterada) ou 202 (solicitação pendente). |
| DELETE | `/disponibilidades/:id` | P C | 204. Professor, após a publicação, só remove solicitação pendente própria. |
| GET | `/disponibilidades/pendentes` | C | Solicitações pendentes, com o intervalo original quando houver. |
| POST | `/disponibilidades/:id/aprovar` | C | Aprova a solicitação. |
| POST | `/disponibilidades/:id/rejeitar` | C | Rejeita a solicitação. |

### Relatórios

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/relatorios/resumo` | C | Totais, aulas semanais por turma e por professor, horas disponíveis, versões por status e pendências. |

## Parte 2 (a implementar pela dupla)

Devem ser adicionadas em `backend/src/routes/horarios.js`, que já exige autenticação em todas as rotas do router. Cada rota abaixo deve usar `somenteCoordenador` e gravar o histórico com `registrarHistorico`.

| Método | Rota | Acesso | Observação |
|---|---|---|---|
| POST | `/horarios/gerar` | C | Cria versão em rascunho com a proposta e devolve conflitos e aulas não alocadas. Insumos: `turma_disciplinas`, `disponibilidades` com status `aprovada`, `turnos` e `salas`. |
| PUT | `/horarios/:id` | C | Altera uma alocação. O banco rejeita conflitos (erro 23P01, já traduzido para 409). |
| POST | `/horarios/versoes/:id/publicar` | C | Em transação: arquiva a versão publicada anterior do período e publica a nova. |
| GET | `/horarios/conflitos` | C | Conflitos de uma versão. |
