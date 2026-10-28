# Divisão de tarefas da dupla

## Parte 1 (concluída neste repositório)

| Área | Entrega |
|---|---|
| Requisitos e documentação | `docs/requisitos.md`, `docs/regras-negocio.md`, `README.md` |
| Banco de dados | `sql/`, `docs/der.png`, `docs/banco-de-dados.md` |
| Autenticação e permissões | `backend/src/middleware`, `routes/auth.js` |
| API base | Cadastros, disponibilidades, consultas de horários, relatório |
| Testes de segurança | `backend/test`, `docs/plano-de-testes.md`, `docs/evidencias` |

## Parte 2 (restante da dupla)

| Área | O que fazer | Apoio já pronto |
|---|---|---|
| Algoritmo de geração | Alocar aulas respeitando disponibilidade, turnos, intervalos, carga semanal e conflitos. Devolver relatório de conflitos e aulas não alocadas. | Dados em `turma_disciplinas`, `disponibilidades` (status `aprovada`), `turnos`, `salas`. Restrições de exclusão no banco. |
| Rotas de horários | `POST /horarios/gerar`, `PUT /horarios/:id`, `POST /horarios/versoes/:id/publicar`, `GET /horarios/conflitos`. | `routes/horarios.js` (já autenticado), `somenteCoordenador`, `registrarHistorico`, tradução do erro 23P01 para 409. |
| Frontend | Login, painéis por perfil, grade semanal responsiva com sala, docente e situação. | `docs/api-contrato.md`. Login por `POST /api/auth/login`, sem precisar do SDK do Supabase. |
| Deploy | Vercel, Render e variáveis de ambiente. | `README.md`, `.env.example`. |
| Desafio adicional | PDF, notificações, ocupação das salas, minimização de janelas. | `GET /relatorios/resumo` como ponto de partida. |

## Em conjunto

- Cenário de validação ponta a ponta e evidências finais.
- Apresentação técnica: os dois integrantes devem saber explicar o sistema inteiro.
