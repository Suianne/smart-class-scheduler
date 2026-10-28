# SUCELSO TECH | Sistema Inteligente de Horários Escolares

Aplicação full stack para organizar horários escolares com base na disponibilidade dos professores. Somente coordenadores criam, aprovam e publicam a grade oficial.

| Camada | Tecnologia | Hospedagem |
|---|---|---|
| Frontend | HTML/CSS/JS ou React | Vercel |
| Backend | Node.js + Express | Render |
| Banco e autenticação | PostgreSQL + Supabase Auth | Supabase |

## Estrutura

```
backend/    API REST (Express), scripts e testes
frontend/   Interface (Parte 2)
sql/        Esquema, dados de teste e RLS
docs/       Requisitos, regras de negócio, DER, contrato da API, plano de testes
```

Documentação: [requisitos](docs/requisitos.md), [regras de negócio](docs/regras-negocio.md), [banco de dados e DER](docs/banco-de-dados.md), [contrato da API](docs/api-contrato.md), [plano de testes](docs/plano-de-testes.md), [divisão de tarefas](docs/divisao-de-tarefas.md).

## Situação

| Parte | Estado |
|---|---|
| Banco, autenticação, permissões, cadastros, disponibilidades, consulta de horários, relatório, testes | Concluída (Parte 1) |
| Algoritmo de geração, rotas de versões e publicação, frontend, deploy | Pendente (Parte 2) |

## Como executar

Pré-requisitos: Node.js 18 ou superior e um projeto no Supabase.

### 1. Supabase

1. Crie um projeto em supabase.com.
2. Em **Project Settings > API**, copie a URL, a chave `anon` e a chave `service_role`.
3. Em **Project Settings > Database**, copie a connection string do **Session pooler** (porta 5432). O Render usa IPv4, então prefira o pooler.
4. Em **Authentication > Providers > Email**, mantenha o login por e-mail e senha ativo.

### 2. Backend local

```bash
cd backend
cp .env.example .env        # preencha com os dados do Supabase
npm install
npm run db:schema           # cria tabelas e ativa o RLS
npm run db:seed             # dados fictícios
npm run seed:auth           # cria as contas no Supabase Auth
npm start                   # http://localhost:3000/api/health
```

Se precisar recomeçar: `npm run db:reset`, depois `db:schema`, `db:seed` e `seed:auth` (remova antes as contas antigas em Authentication > Users).

Contas de teste (senha igual a `SEED_PASSWORD`): `coordenacao@sucelso.tech`, `ana.souza@sucelso.tech` (professora), `aluno.a1@sucelso.tech` (aluno). A lista completa está em [banco-de-dados.md](docs/banco-de-dados.md).

### 3. Testes

```bash
cd backend && npm test
```

Os testes não precisam do Supabase nem de `.env`.

### 4. Deploy do backend no Render

| Campo | Valor |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Variáveis | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS` (URL do frontend na Vercel), `NODE_ENV=production` |

No plano gratuito o serviço suspende por inatividade, e a primeira resposta pode demorar.

### 5. Deploy do frontend na Vercel (Parte 2)

Publique a pasta `frontend/` e configure a URL do backend. O frontend nunca recebe a chave `service_role`. Para login, basta chamar `POST /api/auth/login` e enviar o `access_token` no cabeçalho `Authorization: Bearer`.

## Segurança

- A chave `service_role` e a senha do banco ficam apenas no backend, em variáveis de ambiente. O `.env` está no `.gitignore`.
- O perfil do usuário vem da tabela `usuarios`, e cada rota valida a permissão no servidor.
- RLS ativo em todas as tabelas, sem políticas: a API pública do Supabase não acessa os dados.
- Entradas validadas com zod, consultas parametrizadas, helmet, CORS restrito e limite de requisições.

## Para a Parte 2

- Adicione as rotas em `backend/src/routes/horarios.js` (o router já exige autenticação). Use `somenteCoordenador` e `registrarHistorico`.
- Use o banco como rede de segurança: aulas conflitantes de professor, sala ou turma na mesma versão são rejeitadas (409).
- Mantenha os testes de `backend/test/seguranca.test.js`, que já cobrem as rotas da Parte 2 e passam a exigir 403 para aluno e professor quando elas existirem.
