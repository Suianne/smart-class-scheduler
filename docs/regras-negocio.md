# Regras de negócio

| Id | Regra | Onde é garantida |
|---|---|---|
| RN01 | Existem três perfis: aluno, professor e coordenador. O perfil é lido da tabela `usuarios`, nunca do token nem do corpo da requisição. | Middleware `autenticar` |
| RN02 | Aluno só lê. Professor altera apenas a própria disponibilidade. Somente o coordenador cria, ajusta, aprova e publica horários e faz cadastros. | Middleware `exigirPerfil` em cada rota, mais testes |
| RN03 | Contas desativadas (`usuarios.ativo = false`) não acessam nenhuma rota e não fazem login. | Middleware e login |
| RN04 | Cada disciplina vinculada a uma turma tem exatamente um professor e uma carga semanal (1 a 40 aulas). O par turma e disciplina é único. | `turma_disciplinas` (UNIQUE, CHECK) |
| RN05 | A carga horária de uma disciplina é positiva. | CHECK em `disciplinas` |
| RN06 | Todo turno tem início anterior ao fim. O intervalo, quando existe, fica dentro do turno. A duração da aula é de 15 a 240 minutos. | CHECK em `turnos` |
| RN07 | Disponibilidade é por professor, período letivo, dia e intervalo. O início é anterior ao fim. Os dias válidos vão de segunda a sábado. | CHECK em `disponibilidades` e validação na API |
| RN08 | Intervalos de um mesmo professor, período, dia e status não podem se sobrepor. Intervalos adjacentes (um termina quando o outro começa) são permitidos. | API (409) |
| RN09 | Durante a coleta (`periodos_letivos.coleta_aberta`) e antes de existir versão publicada, a alteração feita pelo professor vale de imediato (status `aprovada`). | API |
| RN10 | Com a coleta encerrada ou com versão publicada no período, a alteração feita pelo professor fica `pendente`. A disponibilidade original permanece válida até a decisão do coordenador. | API |
| RN11 | Aprovar uma solicitação marca a disponibilidade original como `substituida`. Rejeitar marca a solicitação como `rejeitada`. Em nenhum dos casos a grade publicada é alterada. Para refletir a mudança, o coordenador gera uma nova versão. | API |
| RN12 | Apenas o coordenador remove disponibilidade aprovada depois da publicação. O professor pode retirar uma solicitação pendente própria. | API |
| RN13 | O coordenador pode registrar e alterar disponibilidade de qualquer professor, sempre de forma direta. | API |
| RN14 | Uma versão de horário tem um dos estados: `rascunho`, `em_revisao`, `publicada` ou `arquivada`. Existe no máximo uma versão publicada por período letivo, e somente ela é oficial. | Índice único parcial `ux_versao_publicada` |
| RN15 | Aluno e professor enxergam apenas a versão publicada. Somente o coordenador consulta outras versões. | Rotas de consulta |
| RN16 | Em uma mesma versão, um professor, uma sala ou uma turma não podem ter duas aulas no mesmo intervalo do mesmo dia (aulas canceladas não contam). | Restrições de exclusão `ex_hor_professor`, `ex_hor_sala` e `ex_hor_turma` |
| RN17 | O professor só consulta turmas nas quais leciona. O aluno só consulta a própria turma. | Rotas de consulta |
| RN18 | Toda criação, alteração, remoção, aprovação ou rejeição grava um registro em `historico_alteracoes`, na mesma transação da operação. | `registrarHistorico` |
| RN19 | Registros com vínculos (turma com alunos, professor com disciplinas, disciplina com turmas) não podem ser removidos. | FKs com `ON DELETE RESTRICT` (409) |
| RN20 | Criar professor ou aluno cria a conta no Supabase Auth, o usuário e o perfil como uma única operação. Se o banco falhar, a conta criada no Auth é removida. | `routes/pessoas.js` |

## Parâmetros do cenário de teste

- Aulas de 60 minutos.
- Turno da manhã: 08:00 às 12:20, intervalo das 10:00 às 10:20 (4 aulas por dia).
- Turno da tarde: 13:00 às 17:20, intervalo das 15:00 às 15:20 (4 aulas por dia).
- Semana letiva de segunda a sexta (20 aulas por turma por semana).
