# SUCELSO TECH — Smart Class Scheduler

Sistema web para gestão de horários escolares. O coordenador administra cadastros, disponibilidades e versões de grade; professores registram disponibilidades e consultam suas aulas; alunos consultam a grade publicada de sua turma.

## Funcionalidades

- Autenticação por e-mail e senha com Supabase Auth.
- Perfis de acesso: coordenador, professor e aluno.
- Gestão de professores, alunos, disciplinas, salas, turmas, turnos e períodos letivos.
- Registro, edição e aprovação de disponibilidades docentes.
- Geração automática de propostas de horário, respeitando disponibilidades, turnos e recursos.
- Diagnóstico de conflitos e aulas não alocadas.
- Edição manual de aulas em versões ainda não publicadas.
- Publicação de grade completa e arquivamento da versão publicada anteriormente.
- Consulta de horários conforme o perfil de acesso.
- Relatório geral e exportação de informações em CSV e PDF.
- Histórico de alterações e validações de segurança no backend.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React, Vite, React Router |
| Backend | Node.js, Express 5 |
| Banco de dados | PostgreSQL (Supabase) |
| Autenticação | Supabase Auth |
| Validação | Zod |
| Testes backend | Node Test Runner, Supertest e PGlite |
| Deploy previsto/documentado | Frontend: Vercel; API: Render; banco/autenticação: Supabase |

## Estrutura do repositório

```text
backend/    API REST, integração Supabase, scripts e testes
frontend/   aplicação React/Vite
sql/        esquema, dados fictícios e configuração de RLS
docs/       requisitos, regras de negócio, DER, contrato da API e plano de testes
```

Documentação complementar:
- [Requisitos](docs/requisitos.md)
- [Regras de negócio](docs/regras-negocio.md)
- [Banco de dados e DER](docs/banco-de-dados.md)
- [Contrato da API](docs/api-contrato.md)
- [Plano de testes e evidências](docs/plano-de-testes.md)
- [Roteiro de demonstração](docs/roteiro-demonstracao.md)

## Pré-requisitos

- Node.js 20.19 ou superior (ou 22.12 ou superior), compatível com a versão atual do Vite.
- npm.
- Projeto Supabase com PostgreSQL e Authentication habilitados.
- Acesso às credenciais do projeto Supabase.

## Configuração local

### 1. Backend

No terminal:

```powershell
cd backend
Copy-Item .env.example .env
```

Preencha o arquivo `backend/.env` com as credenciais do seu projeto Supabase:

| Variável | Finalidade |
|---|---|
| `NODE_ENV` | Ambiente; use `development) localmente. |
| `PORT` | Porta HTTP da API (padrão: 3000). |
| `DATABASE_URL` | Connection string PostgreSQL do Supabase. |
| `SUPABASE_URL` | URL do projeto Supabase. |
| `SUPABASE_ANON_KEY` | Chave pública anon, usada pelo backend para login/refresh. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave administrativa usada exclusivamente no backend. |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula. |
| `SEED_PASSWORD` | Senha temporária para criação das contas fictícias de demonstração. |

**Nunca versione o arquivo `.env` nem compartilhe a chave `SUPABASE_SERVICE_ROLE_KEY`.** Essa chave não deve existir no frontend.

Instale as dependências:

```powershell
npm install
```

#### Banco de dados novo (somente ambiente vazio/de demonstração)

Se estiver preparando um projeto Supabase novo e vazio, execute nesta ordem:

```powershell
npm run db:schema
npm run db:seed
npm run seed:auth
```

- `db:schema`: cria as tabelas, restrições e ativa RLS.
- `db:seed`: insere dados fictícios de demonstração.
- `seed:auth`: cria/vincula as contas de demonstração no Supabase Auth; pode ser executado novamente.

**Atenção:** não execute `npm run db:reset` em um banco com dados que deseja preservar. Esse comando apaga tabelas. Não execute novamente `db:seed` em um ambiente já preparado sem antes avaliar o impacto.

#### Iniciar a API

```powershell
npm run dev
```

A API ficará disponível, por padrão, em `http://localhost:3000`. Verifique:

```text
GET http://localhost:3000/api/health
```

A resposta esperada é um JSON com `status: "ok"`.

### 2. Frontend

Em outro terminal:

```powershell
cd frontend
npm install
```

Crie `frontend/.env.local` com a URL base da API:

```dotenv
VITE_API_URL=http://localhost:3000/api
```

Inicie a interface:

```powershell
npm run dev
```

O Vite informa no terminal o endereço local, normalmente `http://localhost:5173`.

### 3. Contas de demonstração

Depois de preparar o banco e executar `seed:auth`, as contas de demonstração usam a senha definida em `SEED_PASSWORD`.

| Perfil | E-mail |
|---|---|
| Coordenador | `coordenacao@sucelso.tech` |
| Professora | `ana.souza@sucelso.tech` |
| Aluno da Turma A | `aluno.a1@sucelso.tech` |

A relação completa das contas fictícias está em [banco-de-dados.md](docs/banco-de-dados.md). Altere a senha de demonstração antes de qualquer uso fora de um ambiente de teste.

## Testes e verificações

### Backend

```powershell
cd backend
npm test
```

Resultado validado nesta etapa: **87 testes aprovados, 0 falhas**. Os testes automatizados usam PGlite e autenticação simulada; não exigem conexão com o Supabase.

### Frontend

```powershell
cd frontend
npm run lint
npm run build
```

Lint e build foram executados com sucesso na validação do projeto.

Consulte [plano-de-testes.md](docs/plano-de-testes.md) para cenários automatizados e verificações manuais.

## Perfis e regras principais

| Perfil | Permissões principais |
|---|---|
| Coordenador | Gerencia cadastros, consulta relatórios, aprova disponibilidades, gera/edita versões e publica grades. |
| Professor | Consulta sua grade e suas turmas; registra e administra somente as próprias disponibilidades. |
| Aluno | Consulta apenas a grade publicada da própria turma. |

A grade só se torna oficial após publicação pelo coordenador. Alunos e professores não visualizam rascunhos. Alterações de disponibilidade após a publicação ficam pendentes e não modificam a grade oficial automaticamente.

## Segurança

- Tokens de acesso são validados pelo Supabase Auth no backend.
- O perfil e o estado ativo são consultados no banco; o cliente não define seu próprio perfil.
- Rotas administrativas exigem autorização de coordenador.
- Entradas são validadas; consultas SQL usam parâmetros.
- Helmet, CORS configurável, rate limiting e limite de corpo JSON estão habilitados.
- Erros internos são registrados no servidor e respondidos sem detalhes sensíveis.
- RLS está habilitado nas tabelas; o acesso aos dados é realizado pela API backend.

## Deploy

A arquitetura documentada permite publicar a API no Render, o frontend na Vercel e manter banco/autenticação no Supabase.

- **Render (backend):** Root Directory `backend`; Build Command `npm install`; Start Command `npm start`. Configure as variáveis de ambiente listadas acima.
- **Vercel (frontend):** Root Directory `frontend`; configure `VITE_API_URL` com a URL pública da API, incluindo `/api`.
- **CORS:** inclua a origem pública exata do frontend em `CORS_ORIGINS` no backend.

O deploy em produção deve ser validado separadamente; os testes locais e as verificações manuais realizadas não significam, por si só, que um ambiente de produção esteja publicado.

## Estado da validação

- Fluxos de coordenador, professor e aluno testados manualmente.
- Grade do período letivo `2026.2` publicada e consultada pelos perfis correspondentes.
- Relatórios e exportações CSV/PDF testados.
- Frontend: lint e build aprovados.
- Backend: 87/87 testes automatizados aprovados.
- Revisão estática de autenticação, autorização, RPC de perfil, rotas, configuração HTTP e tratamento de erros concluída.

