# Auditoria técnica do Gestão de Extintores

**Data:** 24 de setembro de 2026  
**Escopo:** auditoria do código e da estrutura existente, sem alterações funcionais ou estruturais  
**Resultado geral:** o sistema já possui uma base funcional relevante, mas **ainda não está pronto para receber clientes pagantes em escala**. O principal bloqueador é a inconsistência do isolamento multiempresa entre autenticação, dados legados e armazenamento offline. O segundo grupo de riscos envolve ausência de chaves estrangeiras, configuração global indevida e falta de proteção contra abuso de autenticação.

> **Regra aplicada:** esta etapa apenas analisou e documentou. Nenhuma funcionalidade foi removida, nenhum dado foi apagado e nenhuma refatoração foi realizada.

## 1. Resumo executivo

O produto é uma aplicação web React com backend Node/Express, tRPC, Drizzle ORM e MySQL. Existe uma autenticação própria para contas comerciais, com senha protegida por `scrypt`, sessões próprias com token aleatório armazenado como hash e controle administrativo de contas. O domínio principal já cobre clientes, extintores, alertas, ordens de serviço, impressão/PDF, backup local e uma camada PWA/offline.

A arquitetura multiempresa está **parcialmente implementada**. Contas comerciais possuem `member_accounts.id`, e os registros de clientes possuem `clients.accountId`. As consultas principais de clientes, alertas e ordens usam o `accountId` da sessão comercial. Entretanto, o caminho de autenticação OAuth do Manus cria um usuário sem `accountId`; nesse caminho, consultas com `accountId` indefinido retornam dados sem filtro de empresa. Isso pode permitir que um usuário autenticado por OAuth visualize ou administre dados de outras contas, dependendo da forma como esse login é exposto no ambiente de produção.

Também há dados legados sem empresa definida. A migração adicionou `clients.accountId` como campo nullable, sem backfill, sem `NOT NULL`, sem chave estrangeira e sem índice. Extintores e ordens não têm `accountId` próprio, dependendo de uma cadeia indireta pelo cliente. Essa abordagem pode funcionar para o estágio atual, mas precisa de regras explícitas para impedir registros órfãos e tornar as consultas auditáveis.

A camada offline apresenta um risco de privacidade: o IndexedDB usa um único banco por origem e não separa os dados por conta autenticada. Se duas empresas forem acessadas no mesmo navegador/dispositivo, os snapshots locais podem permanecer misturados. O backup local também é um JSON sem criptografia, contendo dados pessoais e comerciais.

## 2. Inventário técnico atual

### 2.1 Tecnologias e execução

| Área | Implementação encontrada | Avaliação |
|---|---|---|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, Radix UI, Wouter | Base moderna e adequada para aplicação de gestão |
| Dados remotos | tRPC 11 com `httpBatchLink` e SuperJSON | Bom contrato tipado entre frontend e backend |
| Backend | Node.js, Express 4, tRPC | Simples de operar e migrável |
| Banco | MySQL/TiDB via Drizzle ORM e `mysql2` | Adequado, mas constraints e índices estão incompletos |
| Autenticação comercial | `member_accounts`, `member_sessions`, cookie próprio, `scrypt` | Boa base, com lacunas de rate limiting e isolamento OAuth |
| Autenticação adicional | Manus OAuth em `users` e `sdk.authenticateRequest` | Forte dependência externa e caminho de tenancy inconsistente |
| PWA | Manifesto, service worker, cache versionado, atualização automática | Implementado; precisa de testes reais em Android e política de migração de cache |
| Offline | Dexie/IndexedDB, snapshots, fila de mutações, backup JSON | Funcional em conceito, mas não isolado por conta e incompleto para atualizações |
| PDF | jsPDF no navegador e componente de documento de OS | Adequado para impressão e compartilhamento local |
| Armazenamento | Helpers Manus Forge/S3 disponíveis | Não há fluxo de upload de fotos implementado no domínio atual |
| Testes | Vitest: 7 testes em 3 arquivos | Cobertura insuficiente para segurança multiempresa e offline |

### 2.2 Estrutura de pastas e páginas

As páginas principais são `LoginPage`, `Home`, `AdminUsersPage`, `BackupPage`, `PrintOrderPage` e `NotFound`. Os componentes importantes incluem o layout do painel, documento de OS, barra de status PWA e componentes Radix/shadcn. O dashboard principal concentra aproximadamente 1.753 linhas em `Home.tsx`, incluindo queries, mutações, formulários, navegação, filtros, impressão e sincronização offline.

As rotas identificadas em `App.tsx` são `/login`, `/`, `/admin/usuarios`, `/backup`, `/os/:id` e `/404`. As rotas de negócio ficam protegidas por `Protected`, mas a proteção visual da rota é apenas uma camada de interface; a segurança efetiva depende das procedures tRPC e das funções de banco.

### 2.3 Variáveis de ambiente

Foram encontrados `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `NODE_ENV` e `PORT`. O relatório não verificou os valores secretos, apenas o uso no código. Não há evidência no repositório analisado de validação obrigatória de segredo forte na inicialização.

## 3. Mapa de autenticação e autorização

### 3.1 Fluxos existentes

O login comercial recebe e-mail e senha em `auth.login`, verifica a conta em `memberAuth.authenticateMember`, cria uma sessão de 30 dias e grava o token em cookie `member_session_id`. Apenas o hash SHA-256 do token é persistido no banco. O logout remove a sessão correspondente e limpa os cookies.

A recuperação de senha usa um código de recuperação armazenado como hash `scrypt`. Quando usado, o código é rotacionado e todas as sessões da conta são revogadas. A alteração de senha própria exige a senha atual. O administrador pode criar contas, bloquear contas e redefinir senhas.

O frontend salva informações resumidas do usuário em `localStorage` para permitir reabertura offline. Esse cache é útil para continuidade, mas não é um mecanismo de autenticação do backend. Ele apenas permite que a interface seja exibida offline; nenhuma chamada protegida deveria ser aceita pelo servidor sem cookie válido.

### 3.2 Tipos de usuário atuais

Existem dois campos de papel, em estruturas diferentes:

- `users.role`: usuário Manus OAuth, com `user` ou `admin`.
- `member_accounts.role`: conta comercial própria, com `user` ou `admin`.

Na prática, o administrador central é representado por uma conta comercial com `role = admin`, e usuários comerciais comuns por `role = user`. Não existe ainda uma entidade explícita de empresa/tenant, nem papéis distintos como administrador da plataforma, administrador da empresa, técnico ou somente leitura.

### 3.3 Achado crítico: caminho OAuth sem tenant

**Gravidade: crítica.**

**Onde está:** `server/_core/context.ts`, especialmente a montagem do contexto OAuth; `server/db.ts`, nas funções que tratam `accountId` como opcional; `server/routers.ts`, nas procedures protegidas de negócio.

**Por que é um problema:** quando a sessão comercial existe, o contexto define `accountId` para a conta comercial. Quando não existe, o código tenta `sdk.authenticateRequest`. Se OAuth autenticar um usuário Manus, `ctx.user` fica preenchido, mas `ctx.accountId` permanece indefinido. As funções de banco interpretam `accountId` indefinido como ausência de filtro.

**Risco:** um usuário autenticado pelo caminho OAuth pode receber listagens sem filtro de empresa, porque `getClients`, `getDistinctCities`, `getExpiringExtinguishers`, `getServiceOrders` e as estatísticas consultam todas as empresas quando `accountId` não é fornecido. As mutações também podem operar sobre IDs globais nesse modo. Isso viola o requisito de que Empresa A nunca veja dados da Empresa B.

**Correção posterior recomendada:** separar claramente identidade de plataforma e identidade de tenant. Para o produto comercial, toda procedure de negócio deve exigir um `tenantId/accountId` válido. O caminho OAuth deve ser bloqueado para dados comerciais, receber um mapeamento explícito para uma conta ou ficar limitado a funções internas da plataforma. Não se deve resolver isso apenas escondendo menus.

**Impacto:** alto, mas a correção pode ser feita sem recriar o sistema. Será necessário definir a política do login OAuth e centralizar um middleware de tenant obrigatório.

### 3.4 Achado alto: dados offline não são separados por conta

**Gravidade: alta.**

**Onde está:** `client/src/offline/localDb.ts` e `client/src/offline/hooks.ts`.

**Por que é um problema:** o banco Dexie usa um único nome, `gestao-extintores-offline`, e as tabelas não possuem `accountId` ou uma chave de partição. O snapshot online grava clientes, extintores, ordens e alertas no mesmo espaço local. A conta autenticada não participa da chave do IndexedDB.

**Risco:** após usar a conta da Empresa A e depois entrar na conta da Empresa B no mesmo navegador, o modo offline pode apresentar dados antigos da Empresa A. O risco aumenta quando uma conta é bloqueada ou quando um usuário troca de login no mesmo aparelho.

**Correção posterior recomendada:** incluir uma partição explícita por conta, por exemplo `tenantKey`, em todas as tabelas locais, ou usar um banco Dexie por conta. Ao detectar troca de conta, limpar ou separar o espaço local anterior. Backups também devem registrar a conta de origem e rejeitar restauração em outra conta sem confirmação e validação.

**Impacto:** alto. A correção deve preceder clientes pagantes que compartilhem aparelhos ou navegadores.

## 4. Auditoria multiempresa por entidade

| Entidade | Identificação de empresa | Verificação backend | Risco atual |
|---|---|---|---|
| Empresas/contas | `member_accounts.id`, mas não existe tabela `companies` | Administrador lista contas | Modelo mistura conta de login com empresa; dificulta planos e múltiplos usuários |
| Usuários | `member_accounts.id` e papel | `adminProcedure` controla operações administrativas | Uma conta corresponde a uma empresa; não há usuários múltiplos por tenant |
| Clientes | `clients.accountId` nullable | Parcialmente filtrado por `ctx.accountId` | OAuth sem accountId e dados legados sem tenant |
| Locais | Não existe entidade própria | Não aplicável | Endereço/cidade ficam dentro do cliente; múltiplos locais não são suportados estruturalmente |
| Extintores | Apenas `clientId` | Validado indiretamente pelo cliente | Sem FK; depende da integridade do cliente |
| Ordens | Apenas `clientId` | Join com cliente nas leituras principais | Sem FK; risco de órfãos e dificuldade de auditoria direta |
| Itens de OS | Apenas `serviceOrderId` | Excluídos junto com OS no fluxo normal | Sem FK; podem ficar órfãos |
| Inspeções/manutenções | Não existem tabelas | Não aplicável | Funcionalidade futura, não modelada |
| Documentos/fotos | Não há tabelas de domínio | Não aplicável | Não existe histórico persistido de documentos ou fotos |
| Alertas | Calculados a partir de extintores | Filtro por cliente no caminho com accountId | Não há persistência remota de alertas; cache local sem tenant |
| Relatórios | Não há entidade própria | Não aplicável | PDF é gerado no navegador |
| Configurações | `system_settings` global | Leitura protegida, escrita administrativa | `alert_days_ahead` é global para todas as empresas |

### Resposta direta ao cenário Empresa A versus Empresa B

No caminho de sessão comercial próprio, as consultas de clientes, cidades, alertas, ordens e estatísticas filtram por `ctx.accountId` em nível de serviço. Esse é um ponto positivo. Porém, o sistema não garante isso em todos os caminhos porque `accountId` é opcional e o contexto OAuth não o define. Portanto, **não é possível declarar o isolamento multiempresa como seguro no estado atual**.

Também existe risco operacional offline: a separação entre empresas não existe no IndexedDB. Mesmo que o backend esteja correto, o navegador pode exibir dados locais da conta anterior.

## 5. Auditoria de segurança

### 5.1 Pontos positivos

As senhas não são armazenadas em texto puro. O código usa salt aleatório e `scryptSync`, com comparação resistente a timing. Tokens de sessão são aleatórios e apenas o hash é armazenado. O cookie da sessão é `httpOnly`, tem caminho `/` e, em requisições HTTPS, recebe `secure`.

As procedures administrativas usam verificação de papel no backend. Bloquear e redefinir contas não depende somente da existência de botões na interface. O endpoint de recuperação usa código genérico de erro para credenciais inválidas, reduzindo exposição direta de existência de conta.

### 5.2 Lacunas de autenticação

Não há rate limiting visível para login, recuperação de senha, criação de sessão ou tentativas de verificar senha. Isso permite tentativas automatizadas contra e-mail/senha e código de recuperação. O banco também não mostra política de limpeza de sessões expiradas; a validação impede uso após expiração, mas os registros podem acumular.

O cookie usa `SameSite: none` em vez de uma política mais restritiva. Essa escolha pode ser necessária em determinados ambientes, mas aumenta a superfície de CSRF e deveria ser justificada por fluxo de origem cruzada. Para o login próprio no mesmo site, `lax` seria normalmente mais restritivo, sujeito à validação do ambiente final.

O `JWT_SECRET` aparece configurável no ambiente, mas não há validação explícita de presença e entropia no arranque. A sessão comercial não depende diretamente dele, mas o restante da infraestrutura Manus pode depender.

### 5.3 Autorização e exposição de dados

A lista administrativa não retorna `passwordHash` nem `recoveryCodeHash`, o que é correto. O código de recuperação recém-criado é retornado ao navegador e exibido em toast para entrega manual. Isso é aceitável como fluxo provisório, mas o código deve ser tratado como segredo e não deve aparecer em logs, telemetria ou histórico do navegador.

A procedure `auth.me` é pública no sentido tRPC, mas retorna apenas o usuário derivado do contexto. Não há, no trecho analisado, retorno de hashes ou tokens.

### 5.4 Banco e API

As entradas tRPC usam Zod para validar tipos básicos. Há validação de comprimento mínimo para senhas e alguns campos obrigatórios. Não há evidência de rate limiting, auditoria de ações, proteção de concorrência para número de OS ou validações de domínio mais profundas, como CNPJ, CPF, datas impossíveis e valores monetários não negativos.

As queries usam Drizzle e não constroem SQL a partir de strings de usuário, o que reduz o risco de SQL injection no código analisado. A consulta `MAX(orderNumber) + 1` não é segura contra concorrência: duas criações simultâneas podem obter o mesmo próximo número.

### 5.5 Uploads e arquivos

Não há fluxo de upload de fotos ou anexos implementado nas páginas e routers de negócio analisados. Os helpers de storage usam Forge/S3 com chave aleatória e presigned URLs, mas não há endpoint de domínio que valide tipo, tamanho, extensão, proprietário e tenant. Se uploads forem adicionados, essas validações devem existir no backend, e a chave deve conter tenant e entidade proprietária.

## 6. Auditoria do banco de dados

### 6.1 Estrutura atual

O banco possui tabelas para usuários Manus, contas comerciais, sessões comerciais, clientes, extintores, ordens de serviço, itens de OS e configurações. Não existem tabelas para empresas como entidade separada, locais, inspeções, manutenções, fotos, documentos, histórico, notificações, planos, assinaturas, pagamentos ou logs de auditoria.

### 6.2 Integridade referencial

As migrações SQL não criam chaves estrangeiras entre `clients.accountId` e `member_accounts.id`, entre `extinguishers.clientId` e `clients.id`, entre `service_orders.clientId` e `clients.id` ou entre `service_order_items.serviceOrderId` e `service_orders.id`. As relações Drizzle também estão vazias.

Hoje o código tenta manter a integridade manualmente. Porém, exclusões, importações, scripts administrativos e futuras rotinas podem criar registros órfãos. A ausência de índices explícitos em colunas de relacionamento também tende a aumentar o custo das consultas à medida que o volume cresce.

### 6.3 Configuração global

`system_settings.settingKey` é global. Assim, a antecedência de alerta é uma configuração única para todo o sistema, embora o produto tenha várias empresas. Isso não é vazamento de dados, mas impede configuração por tenant e pode produzir comportamento incorreto para clientes com políticas diferentes.

### 6.4 Crescimento

Para 10 empresas e poucos milhares de extintores, a arquitetura pode funcionar com correções pontuais. Para 100 ou 500 empresas, os principais gargalos serão:

1. `Home.tsx` carrega listas inteiras de clientes e ordens, sem paginação no backend.
2. `getDashboardStats` carrega clientes e ordens completos para contar registros, em vez de usar `COUNT` e agregações SQL.
3. `getServiceOrders` retorna todas as ordens da conta.
4. Alertas são calculados em memória depois de trazer dados do banco.
5. `MAX(orderNumber)` não escala bem e permite colisão sob concorrência.
6. Ausência de índices em `accountId`, `clientId`, datas de vencimento e chaves de sessão prejudica filtros e joins.
7. O snapshot offline tenta manter listas completas no navegador, sem política de retenção ou sincronização incremental.

## 7. Auditoria de desempenho

O carregamento inicial do dashboard dispara várias queries independentes: estatísticas, cidades, clientes, alertas, ordens, configuração e, quando aplicável, detalhes de OS. O uso de `httpBatchLink` pode agrupar chamadas HTTP, mas o backend ainda executa consultas separadas.

O dashboard inteiro está concentrado em um componente grande. Isso aumenta o custo de manutenção e pode dificultar renderizações seletivas. O bundle de frontend ultrapassa 1,4 MB no build analisado, com aviso do Vite sobre chunks maiores que 500 kB. O jsPDF e html2canvas aparecem no bundle, embora o fluxo atual privilegie PDF nativo.

Não há paginação de clientes, extintores ou ordens. Busca e filtros parecem ocorrer principalmente no frontend depois da carga dos dados. Isso é adequado para demonstração e bases pequenas, mas não para milhares de registros.

A geração do dashboard deve ser reescrita posteriormente para agregações SQL. A listagem deve receber paginação, ordenação e filtros no backend. O detalhe de uma OS deve continuar sob demanda.

## 8. Auditoria offline, backup e recuperação

### 8.1 O que existe

O IndexedDB armazena clientes, extintores, ordens, alertas, configurações, metadados e uma fila de mutações. Existe exportação/importação JSON e sincronização automática da fila quando a conexão retorna. O service worker mantém o shell e elimina caches antigos após ativação de nova versão.

### 8.2 Riscos encontrados

O armazenamento offline não tem isolamento por conta, conforme descrito na seção multiempresa. O backup é local ao navegador, não é backup do banco MySQL e não possui histórico versionado no servidor. A importação limpa as tabelas locais e substitui os dados atuais, o que pode apagar alterações locais pendentes se o usuário confirmar um arquivo inadequado.

O JSON contém dados pessoais como nome, telefone, endereço, CPF, CNPJ e informações de clientes. Ele não é criptografado nem protegido por senha. Qualquer pessoa com acesso ao arquivo pode ler os dados.

A fila de mutações cobre criação e exclusão, mas não há mutações de atualização implementadas no frontend. A sincronização também depende de a aplicação detectar corretamente a volta da rede; falhas de conectividade com `navigator.onLine = true` continuam sendo uma condição que precisa de tratamento robusto.

A exclusão offline de um cliente remove registros locais relacionados, mas enfileira apenas a exclusão do cliente. Ordens remotas associadas podem permanecer no servidor se o backend não as remover em cascata. Como não existem FKs nem deleção de ordens no `deleteClient`, esse é um risco real de órfãos.

## 9. Dependência do Manus e possibilidade de migração

| Dependência | Classificação | Motivo |
|---|---|---|
| React, Vite, TypeScript, Tailwind, Wouter | Fácil de migrar | Ecossistema aberto e configuração local conhecida |
| Node, Express, tRPC, Drizzle, MySQL | Fácil de migrar | Tecnologias amplamente disponíveis |
| Autenticação própria de membros | Fácil de migrar | Código e tabelas estão no projeto |
| Manus OAuth e runtime | Forte dependência | `sdk.authenticateRequest`, callback e runtime dependem da plataforma |
| Forge API para storage | Forte dependência | Presign e proxy usam endpoints proprietários |
| `vite-plugin-manus-runtime` | Migrável com trabalho | Precisa ser removido/substituído no build e desenvolvimento |
| Publicação, preview e metadados WebDev | Forte dependência operacional | A hospedagem e o fluxo de deploy são específicos |
| PDF com jsPDF | Fácil de migrar | Biblioteca aberta executada no navegador |

A migração para outro servidor é tecnicamente possível, principalmente se o login comercial próprio for adotado como caminho principal e os arquivos forem movidos para S3 compatível. O trabalho maior será substituir OAuth, storage proxy, runtime, deploy e segredos gerenciados, além de validar cookies, URLs e banco.

## 10. Auditoria de código e manutenção

A organização por páginas, componentes, hooks e routers é compreensível. O principal problema é a concentração de responsabilidades em `Home.tsx`, que mistura UI, estado de formulários, queries, CRUD, PDF, navegação, cache local e sincronização. Esse arquivo tem alto risco de regressão.

`server/db.ts` também acumula acesso a usuários, clientes, extintores, ordens, estatísticas e configurações. A função `accountCondition` existe, mas não é usada como uma política central de isolamento. A segurança depende de cada consulta lembrar de passar `accountId`.

As exceções geralmente são convertidas em mensagens de toast no frontend. Falta uma estratégia uniforme de códigos de erro, logs estruturados, correlação de requisição e auditoria de ações administrativas. O projeto tem somente sete testes automatizados em três arquivos. Não há testes de autorização por tenant, recuperação de senha com expiração, concorrência de OS, service worker, IndexedDB ou restauração de backup.

## 11. Auditoria da experiência do usuário e celular

A interface já possui menu lateral responsivo, cartões clicáveis, alertas de validade, cadastro de cliente e geração de OS. O layout observado é adequado para desktop e razoável para uso móvel. A barra de status mostra online/offline e instalação, e os formulários têm labels básicos.

As melhorias mais importantes são operacionais. Exclusões devem usar confirmação consistente e explicar o impacto sobre extintores, OS e sincronização. O usuário precisa ver quando há alterações pendentes, quando uma sincronização falhou e qual foi a última sincronização bem-sucedida. Estados de carregamento e erro devem ser consistentes em todas as abas.

Para técnicos em campo, ainda não há câmera, QR Code, fotos, inspeção rápida, modo de leitura com uma mão ou fluxo específico para localizar um extintor. A interface atual foi preparada para gestão administrativa, mas não para uma rotina completa de vistoria em campo.

Não há evidência de implementação de upload de fotos, QR Code, geolocalização ou assinatura digital. Esses itens devem ser tratados como funcionalidades futuras, não como falhas de recursos já prometidos.

## 12. Funcionalidades comerciais e administrador da plataforma

A arquitetura atual permite evoluir para SaaS, mas ainda não possui entidades próprias para `companies`, `plans`, `subscriptions`, `usage_limits`, `billing_status`, `trial_ends_at`, auditoria ou suporte. O fato de `member_accounts` conter `companyName` funciona para uma empresa por login, mas não suporta corretamente vários usuários na mesma empresa.

Um painel do dono do SaaS pode ser criado no futuro, mas deverá usar um domínio administrativo separado do papel `admin` de uma conta comercial. O modelo recomendado é: plataforma, empresas/tenants, usuários da empresa, papéis, assinatura, limites e auditoria. Não se deve ampliar o `role` atual sem definir essa separação.

## 13. Oportunidades de melhoria do produto

| Oportunidade | Prioridade | Motivo |
|---|---|---|
| Isolamento offline por empresa | Alta | Evita exibição cruzada de dados no mesmo dispositivo |
| QR Code individual por extintor | Alta | Reduz tempo de identificação no campo |
| Inspeção rápida pelo celular | Alta | Converte o sistema de cadastro em ferramenta operacional |
| Histórico de inspeções e manutenções | Alta | Aumenta valor comercial e rastreabilidade |
| Fotos vinculadas ao extintor/OS | Alta | Evidência de execução e suporte a auditorias |
| Relatórios por cliente, cidade e validade | Média | Melhora gestão e retenção de clientes |
| Notificações por e-mail/WhatsApp | Média | Aumenta recorrência de uso, dependendo de consentimento e integração |
| Calendário de vencimentos e visitas | Média | Ajuda planejamento de equipes |
| Importação CSV/Excel | Média | Reduz barreira de entrada de empresas existentes |
| Orçamento e aprovação | Média | Amplia o fluxo comercial além da OS |
| Assinatura digital | Média | Melhora validade operacional dos documentos |
| Controle financeiro | Baixa/Média | Agrega valor, mas aumenta escopo regulatório e contábil |
| Dashboard avançado | Baixa | Deve vir depois de paginação e agregações corretas |

## 14. Plano seguro de testes multiempresa

Os testes abaixo devem ser executados somente em ambiente de teste, com contas e dados artificiais:

1. Criar Empresa A com usuário A1 e, se aplicável, A2.
2. Criar Empresa B com usuário B1 e B2.
3. Cadastrar clientes, extintores e OS distintos em cada empresa.
4. Com A1 autenticado, chamar diretamente cada query usando IDs conhecidos de B: cliente por ID, extintores por cliente, OS por ID e listagens.
5. Tentar com A1 atualizar e excluir IDs de B usando chamadas tRPC diretas.
6. Repetir usando B1 e IDs de A.
7. Testar URLs `/os/:id` e rotas administrativas diretamente.
8. Trocar de conta no mesmo navegador, cortar a Internet e verificar o IndexedDB local.
9. Exportar backup de A e tentar restaurá-lo no contexto de B; verificar se o sistema rejeita ou isola o arquivo.
10. Testar usuário bloqueado com sessão existente, sessão expirada e logout em outro dispositivo.
11. Testar o caminho OAuth separadamente, pois ele é o principal ponto onde `accountId` pode ficar indefinido.
12. Confirmar que cada tentativa negada não altera registros e que os logs não revelam dados da empresa adversária.

O teste deve comparar respostas e efeitos no banco. Não é suficiente verificar apenas se um botão aparece ou desaparece.

## 15. Matriz de risco

| Problema encontrado | Gravidade | Impacto | Como corrigir | Prioridade |
|---|---|---|---|---|
| Usuário OAuth pode ter `ctx.user` sem `ctx.accountId` e cair em consultas sem filtro | Crítica | Possível visualização, alteração ou exclusão entre empresas | Exigir tenant em toda procedure de negócio e bloquear/mapear OAuth comercial | Antes de pagantes |
| IndexedDB único sem partição por conta | Alta | Dados da Empresa A podem aparecer offline para B no mesmo aparelho | Particionar por tenant e invalidar dados ao trocar conta | Antes de pagantes |
| `accountId` nullable e registros legados sem backfill | Alta | Dados sem dono claro; risco de vazamento e migração ambígua | Classificar registros legados, atribuir tenant e tornar obrigatório | Antes de pagantes |
| Ausência de FKs e índices em relacionamentos | Alta | Órfãos, joins lentos e integridade manual frágil | Criar constraints, índices e política de deleção | Antes de escalar |
| Configuração de alertas global | Média | Uma empresa altera o comportamento de todas | Mover configuração para tenant | Antes de escalar |
| Sem rate limiting para login e recuperação | Alta | Ataques de força bruta e abuso operacional | Limitar por IP, conta e janela; adicionar backoff e logs | Antes de pagantes |
| Sem atualização offline de registros | Alta | Alterações feitas offline podem ser perdidas ou rejeitadas | Adicionar operações update à fila e resolução de conflitos | Antes de pagantes |
| Exclusão offline de cliente não enfileira ordens relacionadas | Alta | Ordens órfãs permanecem no servidor | Transação/cascade explícita e fila de dependências | Antes de pagantes |
| Backup JSON local sem criptografia | Média | Exposição de CPF, CNPJ, endereço e contatos | Backup protegido por senha ou exportação criptografada | Antes de pagantes |
| Dashboard e listas sem paginação | Alta | Lentidão e alto consumo em bases grandes | Paginação, filtros e agregações SQL | Antes de escalar |
| `MAX(orderNumber)+1` sob concorrência | Média | Números duplicados em criações simultâneas | Sequência/transação/unique composto por tenant | Antes de escalar |
| Ausência de auditoria de ações | Média | Dificulta investigação e suporte | Registrar login, alteração, exclusão, reset e sincronização | Antes de escalar |
| Dependência de OAuth/Forge/Runtime Manus | Média/Alta | Migração exige substituições específicas | Isolar adapters e documentar contrato de migração | Antes de escalar |
| Componente Home com 1.753 linhas | Média | Alto custo de manutenção e regressões | Extrair hooks e subcomponentes após estabilizar segurança | Melhoria importante |

## 16. Nota de prontidão comercial

| Dimensão | Nota | Diagnóstico |
|---|---:|---|
| Segurança | 5/10 | Hashing e sessão são bons, mas faltam rate limiting, auditoria e política consistente de tenant |
| Arquitetura | 6/10 | Stack coerente e modular no backend, porém responsabilidades estão concentradas no frontend |
| Multiempresa | 4/10 | Há accountId para membros, mas OAuth, dados legados e offline quebram a garantia integral |
| Banco de dados | 5/10 | Schema funcional, mas sem FKs, índices suficientes, tenant obrigatório e entidades SaaS |
| Desempenho | 5/10 | Adequado para bases pequenas; sem paginação e com agregações em memória |
| Experiência do usuário | 7/10 | Dashboard responsivo e fluxo principal claro; faltam feedbacks de sincronização e campo |
| Preparação para SaaS | 4/10 | Login comercial existe, mas faltam tenant formal, planos, limites, billing e painel da plataforma |
| Manutenibilidade | 5/10 | Código legível, mas `Home.tsx` é grande e a cobertura de testes é baixa |

A nota geral não é uma média de estética. O produto é demonstrável e funcional para uma operação pequena controlada, mas não deve ser vendido como SaaS multiempresa seguro antes das correções críticas.

## 17. Plano de ação recomendado

### Fazer antes de ter clientes pagantes

1. Corrigir o caminho OAuth e tornar o tenant obrigatório em todas as operações de negócio.
2. Definir a política de dados legados com `accountId` nulo e executar uma migração controlada.
3. Isolar o IndexedDB por empresa e proteger a troca de conta.
4. Adicionar testes automatizados de autorização para leitura, atualização e exclusão entre empresas.
5. Adicionar rate limiting e proteção contra tentativas repetidas de login e recuperação.
6. Implementar atualizações offline com fila, dependências e tratamento de conflitos.
7. Corrigir exclusão em cascata de clientes, extintores, OS e itens.
8. Documentar e testar restauração de backup sem mistura de tenants.

### Fazer antes de escalar

1. Criar índices e chaves estrangeiras depois de mapear e corrigir dados existentes.
2. Adicionar paginação, filtros server-side e agregações SQL.
3. Substituir a geração de número de OS por mecanismo seguro contra concorrência.
4. Mover configurações globais para o tenant.
5. Criar logs de auditoria, monitoramento e limpeza de sessões expiradas.
6. Formalizar entidade `companies` e relacionamento de vários usuários por empresa.
7. Isolar adapters de OAuth, storage e runtime para facilitar migração.

### Melhorias importantes

QR Code individual, inspeção móvel, fotos, histórico, relatórios, notificações, calendário, importação CSV/Excel, orçamento e assinatura digital são as melhores extensões para aumentar o valor do produto depois dos bloqueadores de segurança.

### Melhorias futuras

Controle financeiro completo, dashboard avançado, planos sofisticados, pagamentos, suporte integrado e automações de comunicação podem ser adicionados depois que o modelo de tenant, limites e auditoria estiverem estáveis.

## 18. Conclusão

O trabalho já realizado deve ser preservado. A base atual não precisa ser recriada. A prioridade é transformar o isolamento multiempresa em uma regra obrigatória do backend e do armazenamento offline, corrigir integridade do banco e criar uma bateria de testes de segurança. Depois disso, paginação e formalização da entidade empresa permitirão crescer para centenas de contas com menor risco.

O sistema está em condição de continuar desenvolvimento e demonstração controlada. **Ainda não está em condição de operação comercial aberta** até que os riscos críticos e altos sejam tratados.

## Referências internas

[1]: file:///home/ubuntu/gestao-extintores/server/_core/context.ts "Contexto de autenticação e accountId"
[2]: file:///home/ubuntu/gestao-extintores/server/routers.ts "Procedures tRPC e autorização"
[3]: file:///home/ubuntu/gestao-extintores/server/db.ts "Consultas e mutações do banco"
[4]: file:///home/ubuntu/gestao-extintores/server/memberAuth.ts "Autenticação própria e sessões"
[5]: file:///home/ubuntu/gestao-extintores/drizzle/schema.ts "Schema Drizzle"
[6]: file:///home/ubuntu/gestao-extintores/drizzle/0001_sour_leopardon.sql "Migração inicial de entidades"
[7]: file:///home/ubuntu/gestao-extintores/drizzle/0002_chemical_misty_knight.sql "Migração de contas comerciais e accountId"
[8]: file:///home/ubuntu/gestao-extintores/client/src/offline/localDb.ts "Persistência offline e backups"
[9]: file:///home/ubuntu/gestao-extintores/client/src/offline/hooks.ts "Snapshots e instalação PWA"
[10]: file:///home/ubuntu/gestao-extintores/client/src/pages/Home.tsx "Dashboard e operações offline"
[11]: file:///home/ubuntu/gestao-extintores/client/src/pages/BackupPage.tsx "Backup e restauração"
[12]: file:///home/ubuntu/gestao-extintores/client/src/App.tsx "Rotas e proteção visual"
[13]: file:///home/ubuntu/gestao-extintores/package.json "Dependências e scripts"

As conclusões acima foram derivadas da inspeção dos arquivos e migrações listados nas referências. Nenhuma alteração foi aplicada durante a auditoria.
