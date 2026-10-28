# Requisitos e casos de uso

Projeto: SUCELSO TECH, Sistema Inteligente de Horários Escolares.
Escopo deste documento: levantamento de requisitos, perfis e casos de uso (etapa 1 do enunciado).

## 1. Perfis de acesso

| Funcionalidade | Aluno | Professor | Coordenador |
|---|---|---|---|
| Login e consulta de horários | Sim | Sim | Sim |
| Consulta de salas, disciplinas e turmas | Sim | Sim | Sim |
| Registro e alteração da própria disponibilidade | Não | Sim | Sim |
| Gerar proposta de grade | Não | Não | Sim |
| Aprovar, publicar e alterar horários | Não | Não | Sim |
| Cadastros acadêmicos | Não | Não | Sim |
| Relatórios gerais | Não | Não | Sim |

Regra fundamental: alunos têm apenas leitura, professores alteram somente a própria disponibilidade e apenas coordenadores criam, ajustam, aprovam e publicam horários.

## 2. Requisitos funcionais

| Id | Requisito | Módulo |
|---|---|---|
| RF01 | O sistema autentica usuários por e-mail e senha (Supabase Auth). | 1 |
| RF02 | O backend identifica o perfil do usuário a partir do banco e valida a permissão em todas as rotas. | 1 |
| RF03 | O coordenador cadastra, altera e remove professores e alunos. | 2 |
| RF04 | O coordenador cadastra disciplinas (com carga horária), turmas, salas, turnos e períodos letivos. | 2 |
| RF05 | O coordenador vincula disciplina, turma e professor, informando a carga semanal. | 2 |
| RF06 | O professor registra dias e intervalos em que pode lecionar. | 3 |
| RF07 | O professor altera ou remove a própria disponibilidade durante o período de coleta. | 3 |
| RF08 | Após a publicação, alterações de disponibilidade ficam pendentes e dependem do coordenador, sem alterar a grade oficial. | 3 |
| RF09 | O coordenador aprova ou rejeita solicitações pendentes de disponibilidade. | 3 |
| RF10 | O coordenador gera propostas de grade respeitando as restrições (Parte 2). | 4 |
| RF11 | O sistema informa conflitos e aulas não alocadas (Parte 2). | 4 |
| RF12 | O aluno consulta a grade oficial da própria turma. | 5 |
| RF13 | O professor consulta a própria grade e as turmas atribuídas. | 5 |
| RF14 | O coordenador consulta todas as grades, inclusive rascunhos. | 5 |
| RF15 | O coordenador gera versões, revisa, edita e publica (rascunho, em revisão, publicada) (Parte 2). | 6 |
| RF16 | Toda alteração fica registrada no histórico, com usuário, data e valores. | 6 |
| RF17 | O coordenador consulta relatórios gerais de cadastros, cargas e pendências. | 6 |

## 3. Requisitos não funcionais

| Id | Requisito |
|---|---|
| RNF01 | Arquitetura em três camadas: frontend (Vercel), API Node.js/Express (Render) e PostgreSQL (Supabase), com API REST/JSON sobre HTTPS. |
| RNF02 | Credenciais apenas em variáveis de ambiente. A chave service role do Supabase existe somente no backend. |
| RNF03 | Toda entrada é validada no servidor (tipos, formato, tamanho, campos desconhecidos rejeitados) e as consultas SQL são parametrizadas. |
| RNF04 | O acesso direto ao banco pela API pública do Supabase é bloqueado por Row Level Security. |
| RNF05 | Respostas de erro não expõem detalhes internos. Códigos HTTP seguem a semântica (400, 401, 403, 404, 409, 413, 429). |
| RNF06 | Limite de requisições por IP e limite mais rígido para tentativas de login. |
| RNF07 | Integridade garantida pelo banco: chaves, restrições CHECK e restrições de exclusão contra conflitos de horário. |
| RNF08 | Interface responsiva (Parte 2). |

## 4. Casos de uso

| Id | Caso de uso | Ator | Fluxo principal | Exceções |
|---|---|---|---|---|
| UC01 | Entrar no sistema | Todos | Informa e-mail e senha, recebe a sessão e o perfil. | Credenciais inválidas (401). Conta desativada (403). |
| UC02 | Cadastrar dados acadêmicos | Coordenador | Preenche o formulário e confirma. O sistema valida e grava. | Dado duplicado ou vínculo existente (409). Dado inválido (400). |
| UC03 | Registrar disponibilidade | Professor | Escolhe dia e intervalo no período em coleta e salva. | Sobreposição (409). Horário inválido (400). |
| UC04 | Alterar disponibilidade | Professor | Edita um intervalo. Na coleta, a mudança vale de imediato. Após a publicação, vira solicitação pendente. | Registro de outro professor (403). |
| UC05 | Decidir solicitação pendente | Coordenador | Lista as pendências, aprova ou rejeita. | Aprovação que gera sobreposição (409). |
| UC06 | Gerar proposta de grade | Coordenador | Aciona o algoritmo e recebe a grade e o relatório de conflitos (Parte 2). | Sem disponibilidade suficiente: aulas não alocadas listadas. |
| UC07 | Ajustar e publicar versão | Coordenador | Edita alocações, passa a versão por revisão e publica (Parte 2). | Alocação conflitante (409). |
| UC08 | Consultar horário do aluno | Aluno | Abre a grade da própria turma (versão publicada). | Sem versão publicada: grade vazia. |
| UC09 | Consultar horário do professor | Professor | Abre a própria grade e as turmas atribuídas. | Sem versão publicada: grade vazia. |
| UC10 | Consultar qualquer grade | Coordenador | Escolhe turma, professor e versão. | Versão inexistente (404). |
| UC11 | Consultar relatório geral | Coordenador | Abre o resumo de totais, cargas e pendências. | Outros perfis (403). |
