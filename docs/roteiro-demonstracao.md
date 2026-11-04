# Roteiro de demonstração — Smart Class Scheduler

Duração sugerida: 5 a 7 minutos.

## Preparação

- Inicie a API e o frontend conforme o [README](../README.md).
- Confirme que a API responde em `/api/health`.
- Utilize um ambiente de demonstração com os dados fictícios já preparados.
- Use as contas de demonstração descritas em [banco-de-dados.md](banco-de-dados.md); a senha é a definida em `SEED_PASSWORD`.
- A versão publicada do período letivo `2026.2` deve permanecer intacta durante a apresentação.

**Cuidados:** não execute `db:reset`, não rode novamente o seed em um banco com dados que devam ser preservados, não gere outra grade e não publique alterações durante a demonstração. Para demonstrar geração/edição/publicação, utilize um ambiente de teste descartável previamente preparado.

## Sequência sugerida

### 1. Apresentação geral (30–45 segundos)

Explique o objetivo: organizar horários escolares respeitando a disponibilidade dos professores, a carga curricular, as turmas e os recursos, com acesso diferente para coordenador, professor e aluno.

### 2. Coordenador (2 minutos)

Entre com a conta de coordenador e mostre:

1. Painel e indicadores gerais.
2. Cadastros acadêmicos e recursos.
3. Disponibilidades docentes e seus estados.
4. Grade publicada de `2026.2`, alternando a visualização por turma e professor.
5. Relatório geral e exportações CSV/PDF.

Na versão já publicada, mostre a consulta e os relatórios. Não acione geração, edição ou publicação.

### 3. Professor (1 minuto)

Entre com uma conta de professor e mostre:

1. A consulta da própria grade publicada.
2. As turmas em que leciona.
3. A área de disponibilidades, destacando que o professor administra somente as próprias solicitações.

### 4. Aluno (1 minuto)

Entre com uma conta de aluno e mostre:

1. A grade publicada da própria turma.
2. A consulta de cadastros permitida aos perfis autenticados, se pertinente.
3. Que o aluno não possui ações administrativas para alterar ou publicar horários.

### 5. Qualidade e segurança (1 minuto)

Apresente os resultados da validação:

- Frontend: ESLint sem erros e build concluído.
- Backend: 87 testes automatizados aprovados, 0 falhas.
- Cobertura de autenticação, autorização por perfil, regras de disponibilidade, conflitos, geração, edição, publicação, relatórios e tratamento de entradas inválidas.

Os testes automatizados usam PGlite e autenticação simulada; diferencie esses resultados dos testes manuais realizados com o Supabase e a interface.

## Evidências visuais recomendadas

Salvar capturas de tela sem senhas, tokens, chaves ou dados pessoais desnecessários:

- Tela inicial/painel do coordenador.
- Grade publicada por turma.
- Grade publicada do professor.
- Grade do aluno.
- Relatório geral.
- Exemplo de exportação CSV ou PDF.
- Resultado do comando `npm test` mostrando 87 testes aprovados.

## Encerramento

Destaque o fluxo central: disponibilidades docentes → proposta de grade → validação de conflitos → revisão pelo coordenador → publicação → consulta por professor e aluno. A publicação é uma ação administrativa e somente o coordenador pode realizá-la.
