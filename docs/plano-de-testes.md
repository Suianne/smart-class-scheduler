# Plano de testes e evidências (Parte 1)

Execução: `cd backend && npm test`. Resultado completo em `docs/evidencias/testes-backend.txt` (66 testes, 66 aprovados).

Os testes usam o PostgreSQL real em memória (PGlite) carregado com os mesmos scripts de `sql/`, e um provedor de autenticação simulado. Assim validam o esquema, as restrições do banco e as regras da API sem depender do Supabase. A integração com o Supabase Auth e os testes em produção são feitos no deploy (seção 4).

## 1. Cenário obrigatório de validação

| Passo do enunciado | Cobertura | Teste |
|---|---|---|
| 1. Dados mínimos (3 turmas, 6 professores, 8 disciplinas, 5 salas) | Automatizado | `cadastros.test.js`, seed atende ao mínimo |
| 2. Professor registra disponibilidade apenas às segundas e quartas | Automatizado | `disponibilidades.test.js`, cenário 2 |
| 3. Coordenador solicita geração | Parte 2 | |
| 4. Algoritmo respeita disponibilidades e identifica conflitos | Parte 2 (o banco já rejeita conflitos, testado em `horarios.test.js`) | |
| 5. Coordenador ajusta e publica | Parte 2 | |
| 6. Aluno visualiza o horário e não consegue alterá-lo | Automatizado (consulta e bloqueio) | `horarios.test.js` cenário 6, `seguranca.test.js` |
| 7. Professor registra nova disponibilidade sem alterar a grade publicada | Automatizado | `disponibilidades.test.js`, cenário 7 |

## 2. Testes funcionais

| Área | O que é verificado |
|---|---|
| Autenticação | Login, normalização de e-mail, refresh, `/me` por perfil, mensagem igual para senha errada e e-mail inexistente. |
| Cadastros | CRUD, valores padrão, validações (400), duplicidade e vínculos (409), histórico com antes e depois. |
| Professores e alunos | Criação coordenada (Auth, usuário e perfil), reversão da conta de Auth quando o banco falha, desativação e remoção. |
| Disponibilidades | Registro, edição, sobreposição, adjacência, solicitação pendente, aprovação, rejeição, coleta encerrada, histórico. |
| Consulta de horários | Grade do aluno, do professor e do coordenador, rascunho invisível para aluno, turma de outro aluno bloqueada. |
| Banco | Restrições de exclusão de professor, sala e turma. Uma única versão publicada por período. Carga semanal cabe no turno. |
| Relatório | Resumo geral e acesso restrito ao coordenador. |

## 3. Testes de segurança

| Ameaça | Teste | Resultado esperado |
|---|---|---|
| Acesso sem login | Todas as rotas protegidas sem token | 401 |
| Token falso ou adulterado | Variações de token | 401 |
| Aluno ou professor chamando rotas de coordenador direto na API | 26 rotas de coordenador, com os dois perfis | 403 |
| Alteração da grade por aluno ou professor | Tentativas de PUT, POST e DELETE em `/horarios`, com a tabela comparada antes e depois | Grade idêntica |
| Professor mexendo na disponibilidade de outro | PUT, DELETE e POST com `professor_id` alheio | 403, dados intactos |
| Escalada de privilégio pelo corpo | `perfil`, `auth_id`, `ativo` e `status` enviados no corpo | 400 e nenhuma alteração |
| SQL injection | Payloads em ids, filtros, corpo e login | 400, 401 ou tratado como texto, tabelas intactas |
| Entrada inválida | JSON malformado e corpo de 200 kB | 400 e 413 |
| Vazamento de erro interno | Falha simulada no banco | 500 genérico, sem stack nem detalhe |
| Cabeçalhos HTTP | Helmet e remoção de `x-powered-by` | Presentes |
| CORS | Origem permitida e origem estranha | Apenas a configurada |
| Força bruta no login | 32 tentativas em sequência | 429 |
| Conta desativada | Acesso e login | 403 |
| Exposição de chaves | `SUPABASE_SERVICE_ROLE_KEY` aparece apenas em arquivos do backend | Conferido por busca no repositório |
| Dependências | `npm audit --omit=dev` | 0 vulnerabilidades |

## 4. Verificações manuais após o deploy

1. `GET /api/health` responde `ok` na URL do Render (a primeira chamada pode demorar no plano gratuito).
2. Login com os três perfis no frontend publicado.
3. Com a chave anon, uma consulta direta à API REST do Supabase (`/rest/v1/usuarios`) retorna lista vazia, confirmando o RLS.
4. Repetir o cenário da seção 1 de ponta a ponta e anexar capturas de tela à entrega.
