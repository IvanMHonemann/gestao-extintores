# Prompt mestre para recriar o sistema Gestão de Extintores

Você é uma IA desenvolvedora sênior responsável por recriar, do zero, um sistema web full-stack chamado **Gestão de Extintores**. Implemente o sistema com comportamento, regras, organização visual e fluxos descritos abaixo. Não trate este documento como uma sugestão: ele é a especificação funcional e técnica do produto.

## 1. Objetivo do produto

Crie um sistema multiempresa para empresas que trabalham com manutenção, inspeção, recarga e controle de extintores. Cada empresa deve acessar somente seus próprios clientes, extintores, alertas, ordens de serviço, configurações, lixeira e operações offline.

O sistema precisa funcionar como aplicativo web responsivo e PWA, com uso confortável em computador e celular. Deve continuar útil quando a conexão falhar, armazenando sessão, dados locais e operações pendentes para sincronizar depois.

O nome do produto é **Gestão de Extintores**. Use identidade visual neutra e própria. Não use, mencione ou recrie qualquer marca, nome, e-mail, logo ou identidade de terceiros. Em particular, não use “Efraim”, “Efrain”, “Efraim Extintores” nem referências a uma empresa anterior.

Não crie dependência de OAuth, SDK, API, storage, notificações, IA, heartbeat, domínio, ambiente ou serviço proprietário da Manus. O projeto deve rodar em qualquer hospedagem Node.js/Docker com banco MySQL/TiDB e storage S3 compatível.

## 2. Stack obrigatória/preferencial

Use:

- Node.js 22 ou superior;
- TypeScript em modo estrito;
- React 19 com Vite;
- Tailwind CSS;
- Express;
- tRPC para a API tipada;
- Drizzle ORM;
- MySQL ou TiDB usando `mysql2`;
- TanStack React Query através do cliente tRPC;
- Dexie/IndexedDB para o modo offline;
- PWA com `manifest.json` e service worker;
- `pnpm` como gerenciador;
- Vitest para testes;
- Docker e Docker Compose opcionais, mas funcionais;
- S3 compatível para backups: AWS S3, Cloudflare R2, MinIO, Backblaze ou equivalente.

O mesmo processo Node deve servir a API e o bundle frontend em produção. Não use REST paralelo se uma procedure tRPC resolver o caso.

## 3. Identidade visual e experiência

A tela inicial é uma página de login dividida em duas áreas:

- lado esquerdo escuro, com fundo azul-marinho/preto e gradiente discreto vermelho;
- ícone de chama dentro de um quadrado vermelho arredondado;
- nome “CONTROLE DE EXTINTORES” e subtítulo “Gestão & ordens de serviço”;
- texto principal: “Uma área segura para cada empresa.”;
- texto explicando que cada usuário acessa somente seus próprios clientes, extintores, alertas e ordens de serviço;
- indicador inferior de segurança/separação de dados;
- lado direito branco, com o título “Entrar no sistema”, campos de e-mail e senha, botão vermelho “Entrar”, link “Esqueci minha senha” e aviso sobre autenticação própria.

No celular, a página deve reorganizar o conteúdo verticalmente sem overflow horizontal.

Após login, use um dashboard administrativo com:

- cabeçalho escuro;
- menu lateral fixo no desktop;
- menu lateral em gaveta no celular;
- cartões de indicadores;
- páginas e modais responsivos;
- botões vermelhos para ações primárias;
- estados de carregamento, vazio, erro e sucesso;
- toast para feedback de operações;
- foco visível e navegação por teclado;
- textos em português do Brasil.

O produto não deve mostrar nomes da hospedagem, detalhes de infraestrutura ou marcas antigas na interface.

## 4. Autenticação e perfis

Implemente autenticação própria por e-mail e senha. Nunca use OAuth externo.

Use hashing seguro de senha, preferencialmente `scrypt` ou Argon2, e nunca armazene senha em texto puro. Crie sessões com token aleatório; armazene no banco somente o hash do token; entregue o token em cookie HTTP-only, Secure em HTTPS e SameSite apropriado.

Existem dois níveis de identidade:

### 4.1 Administrador global da plataforma

- fica na tabela `platform_admins`;
- não possui `companyId`;
- pode criar e bloquear empresas;
- pode criar, bloquear e redefinir usuários das empresas;
- pode visualizar dados de uma empresa selecionada para suporte/operação;
- não deve receber automaticamente um tenant fixo;
- não pode ser desativado pela própria interface;
- acessa a administração global.

### 4.2 Usuário de empresa

Cada usuário pertence a exatamente uma empresa e possui um dos papéis:

- `company_admin`: gerencia usuários, configurações e dados da empresa;
- `operator`: opera clientes, extintores e ordens de serviço;
- `technician`: executa/consulta a operação de campo conforme as permissões definidas.

As procedures devem verificar o tenant no backend, não confiar em `companyId` enviado pelo frontend. Um usuário de empresa nunca pode consultar, editar, excluir ou restaurar registros de outra empresa.

Inclua:

- login;
- logout;
- recuperação de senha com código de uso único armazenado como hash;
- alteração da própria senha;
- redefinição de senha por administrador autorizado;
- bloqueio/reativação de usuários;
- expiração e limpeza de sessões.

## 5. Banco de dados

Use MySQL/TiDB e timestamps UTC. Crie as entidades abaixo.

### `companies`

- `id` inteiro autoincremento, chave primária;
- `name` obrigatório;
- `active` booleano;
- `createdAt`, `updatedAt`;
- índices para `active` e `name`.

### `platform_admins`

- `id`;
- `userName`;
- `email` único;
- `passwordHash`;
- `recoveryCodeHash` opcional;
- `active`;
- `createdAt`, `updatedAt`.

### `member_accounts`

- `id`;
- `companyId` obrigatório com FK para `companies`;
- `userName`;
- `email` único;
- `passwordHash`;
- `recoveryCodeHash` opcional;
- `role`: `company_admin`, `operator` ou `technician`;
- `active`;
- `createdAt`, `updatedAt`;
- índices por empresa e empresa/papel.

### Sessões

Crie `platform_sessions` e `member_sessions`, cada uma com:

- `id`;
- identidade correspondente;
- `tokenHash` único;
- `expiresAt`;
- `createdAt`;
- índice para expiração.

### `clients`

- `id`;
- `accountId` ou `companyId` obrigatório;
- `companyName`/razão social;
- `cnpj`;
- `address`;
- `city` obrigatório;
- `cep`;
- `phone`;
- `contactName`;
- `cpf`;
- `birthDate`;
- `notes`;
- `createdAt`, `updatedAt`;
- índices por empresa e empresa/cidade.

Deixe claro na interface que a empresa/área de acesso é o tenant do sistema e não necessariamente o cliente atendido.

### `extinguishers`

- `id`;
- `accountId`/`companyId` obrigatório;
- `clientId` obrigatório;
- `typeModel` obrigatório;
- `capacity`;
- `serialNumber`;
- `locationInBuilding`;
- `expirationDate` obrigatório;
- `lastInspectionDate`;
- `status`: `ok`, `warning` ou `expired`;
- `notes`;
- `createdAt`, `updatedAt`;
- índices por empresa, cliente e empresa/data de validade.

Calcule a situação com base na data atual e na configuração de antecedência: válido, próximo do vencimento ou vencido.

### `service_orders`

- `id`;
- `accountId`/`companyId` obrigatório;
- `orderNumber` obrigatório;
- `orderDate`;
- `createdByName`;
- `clientId`;
- `replacedAndDelivered`;
- `leftReserve`;
- `reserveDetails`;
- `extinguisherExpiration`;
- `licenseExpiration`;
- `totalAmount` decimal;
- `paymentMethod`;
- `installmentsCount`;
- `installmentDates`;
- `responsibleName`;
- `responsibleCpf`;
- `responsibleBirthDate`;
- `observations`;
- `createdAt`, `updatedAt`;
- índices por empresa, cliente, empresa/data e empresa/número.

### `service_order_items`

- `id`;
- `serviceOrderId` com exclusão em cascata;
- `description`;
- `quantity`;
- `unitPrice` decimal;
- `totalPrice` decimal;
- `createdAt`;
- índice por ordem.

### `trash_items`

- `id`;
- empresa;
- `itemType`;
- `originalId`;
- `label`;
- `snapshot` JSON/texto;
- `deletedAt`;
- `expiresAt`;
- índices por empresa/expiração e empresa/data de exclusão.

A lixeira deve permitir restauração e exclusão permanente, com expiração automática dos snapshots vencidos.

### `system_settings`

- `id`;
- empresa;
- `settingKey`;
- `settingValue`;
- `updatedAt`;
- índice único por empresa + chave.

Use a configuração `alert_days_ahead`, com valor entre 1 e 365 e padrão de 30 dias.

## 6. Numeração concorrente das ordens de serviço

Nunca calcule o próximo número apenas usando `MAX(orderNumber) + 1`.

Implemente uma sequência segura por empresa. Pode ser uma tabela de sequências ou uma transação equivalente. O algoritmo deve:

1. bloquear/atualizar atomicamente a sequência do tenant;
2. obter o próximo número;
3. criar a ordem dentro de transação;
4. proteger com índice único lógico/físico por empresa + número;
5. repetir automaticamente em caso de conflito transitório;
6. limitar tentativas e retornar erro claro após falha;
7. funcionar com várias requisições simultâneas e várias instâncias do Node.

Adicione teste concorrente que tente criar ordens simultaneamente para a mesma empresa e confirme que não existem números duplicados.

## 7. Dashboard e funcionalidades

Após o login, mostre os cartões:

- Total de Clientes;
- Extintores Ativos;
- Perto da Validade;
- Extintores Vencidos;
- Ordens Geradas.

Cada cartão deve ser clicável e abrir a seção correspondente com o filtro já aplicado.

O menu deve oferecer:

- Visão Geral;
- Clientes por Cidade;
- Alertas;
- Ordens de Serviço;
- Cadastrar Cliente;
- Nova OS;
- Usuários;
- Configuração de antecedência dos alertas;
- Backup e restauração;
- Status da sincronização offline;
- Lixeira, quando autorizado;
- Sair.

### Clientes

Permita:

- cadastrar, editar e excluir cliente;
- pesquisar/filtrar por cidade;
- visualizar detalhes;
- listar extintores do cliente;
- abrir histórico de atendimento;
- iniciar uma OS pelo cliente;
- cadastrar cliente diretamente dentro do formulário da OS e retornar à OS com o novo cliente selecionado.

### Extintores

Permita:

- cadastrar, editar e excluir;
- tipo/modelo;
- capacidade;
- número de série;
- localização no prédio;
- data de validade;
- data da última inspeção;
- observações;
- cálculo visual de status;
- filtro de ativos, próximos do vencimento e vencidos.

### Alertas

Mostre alertas por urgência, com configuração de antecedência por empresa. Diferencie:

- extintor vencido;
- extintor próximo do vencimento;
- extintor dentro da validade.

### Ordem de serviço

O formulário deve conter:

- cliente;
- data;
- responsável;
- CPF e data de nascimento quando aplicável;
- serviços prestados em linhas;
- descrição;
- quantidade;
- valor unitário;
- total por linha;
- total geral;
- substituído/entregue;
- reserva deixada;
- detalhes da reserva;
- validade do extintor;
- validade da licença;
- método de pagamento;
- quantidade e datas de parcelas quando aplicável;
- observações.

Métodos de pagamento mínimos:

- À vista;
- PIX;
- Crédito;
- Parcelado;
- Boleto.

Mostre quantidade e datas de parcelas somente quando o método exigir. Limpe esses campos ao trocar para À vista ou PIX.

A tela da OS deve ter ações para:

- visualizar;
- editar;
- imprimir;
- gerar PDF nativo;
- compartilhar o arquivo PDF no celular quando suportado;
- baixar o PDF no computador;
- abrir o WhatsApp para o usuário anexar o arquivo manualmente quando o navegador não permitir anexação automática.

O PDF deve incluir os dados completos da OS, cliente, endereço, CNPJ, responsável, serviços, quantidades, valores, status, vencimentos, pagamento, observações e áreas de assinatura. Use apenas a identidade neutra “Controle de Extintores” ou “Gestão de Extintores”. Nunca inclua marca antiga, e-mail antigo ou logo de terceiro.

## 8. Modo offline e sincronização

Implemente PWA offline-first com IndexedDB particionado por tenant. Nunca misture dados de empresas diferentes no cache local.

Armazene localmente, quando autorizado:

- sessão atual;
- perfil do usuário;
- clientes recentes/necessários;
- extintores;
- ordens;
- configurações;
- fila de mutações pendentes;
- snapshots/backup local.

Para contas grandes:

- sincronize por páginas;
- use cursor ou paginação estável;
- não baixe milhares de registros de uma vez;
- priorize dados recentes e mais acessados;
- exiba total de operações pendentes;
- informe última sincronização;
- mostre falhas por operação;
- permita reprocessar operação falha;
- use backoff/retry;
- remapeie IDs temporários locais para IDs do servidor;
- preserve a sessão em falhas de rede;
- somente remova sessão após logout explícito ou resposta inequívoca de não autorizado.

Crie uma tela “Status da sincronização” com:

- online/offline;
- tenant atual;
- última sincronização;
- quantidade pendente;
- operações com erro;
- botão sincronizar agora;
- botão reprocessar;
- detalhes da falha;
- exportar/importar backup local.

O service worker deve ter versão, limpar caches antigos e atualizar o app shell com segurança. Não introduza HMR, proxy de desenvolvimento ou URLs localhost no bundle de produção.

## 9. Backup, lixeira e manutenção

Crie scripts operacionais:

- backup do banco para JSON privado;
- restauração somente mediante comando explícito;
- checksum do backup;
- retenção configurável;
- cópia persistente para S3 compatível;
- teste de restauração em banco isolado;
- limpeza de snapshots expirados;
- limpeza de sessões expiradas;
- limpeza de operações offline antigas;
- alertas por webhook genérico em caso de falha.

Variáveis de ambiente:

```dotenv
NODE_ENV=production
PORT=3000
EXTERNAL_DATABASE_URL=mysql://usuario:senha@host:4000/banco?ssl={"rejectUnauthorized":true}
JWT_SECRET=segredo-longo-e-aleatorio
SCHEDULE_SECRET=segredo-longo-e-aleatorio
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=50
DB_CONNECT_TIMEOUT_MS=10000
DB_KEEP_ALIVE_MS=10000
DB_SLOW_QUERY_MS=1000
BACKUP_DIR=/var/backups/gestao-extintores
BACKUP_RETENTION_DAYS=14
BACKUP_COPY_DIR=
S3_ENDPOINT=
S3_REGION=us-east-1
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_BASE_URL=
ALERT_WEBHOOK_URL=
VITE_GOOGLE_MAPS_API_KEY=
```

Nunca grave secrets, backups ou dados reais no Git. Não exiba URL de banco nos logs. Use pool de conexões com limites, timeouts, keep-alive, reconexão segura e aviso de consultas lentas.

Crie endpoint protegido:

```http
POST /api/scheduled/database-maintenance
Authorization: Bearer <SCHEDULE_SECRET>
```

Esse endpoint deve executar backup verificado, checksum, upload S3, retenção e limpeza. Não permita que uma chamada sem secret execute manutenção.

## 10. API tRPC

Organize procedures por domínio e imponha autorização no backend. Inclua, no mínimo:

- `auth.me`;
- `auth.login`;
- `auth.recoverPassword`;
- `auth.changePassword`;
- `auth.logout`;
- administração de empresas;
- administração de usuários globais;
- usuários da empresa;
- clientes: listar, obter, criar, editar, excluir;
- extintores: listar, obter, criar, editar, excluir;
- ordens: listar, obter, criar, editar, excluir;
- estatísticas do dashboard;
- alertas;
- configurações;
- lixeira: listar, restaurar, excluir permanentemente;
- backup local e exportações;
- sincronização paginada e operações offline;
- `system.health` público e sem dados sensíveis.

Valide todas as entradas com Zod. Retorne erros tipados e mensagens em português. Não aceite `companyId` arbitrário do cliente para escapar do tenant atual.

## 11. Segurança e isolamento

- Todo dado comercial deve possuir empresa obrigatória.
- Toda consulta comercial deve filtrar pelo tenant obtido da sessão.
- Verifique também o vínculo entre cliente, extintor e OS.
- Use FK e índices.
- Não exponha hashes, tokens ou secrets.
- Cookies devem ser HTTP-only.
- Use HTTPS em produção.
- Aplique rate limit em login e recuperação de senha.
- Limpe sessões expiradas.
- Não permita que empresa A leia IDs da empresa B.
- Não execute seed demonstrativo em produção.
- Não use schema de sistema do MySQL/TiDB para dados da aplicação.
- Não inclua dependências ou nomes da Manus, OAuth, Forge ou qualquer fornecedor de hospedagem.

## 12. Testes obrigatórios

Crie testes automatizados para:

1. login válido e inválido;
2. logout;
3. recuperação de senha e rotação de código;
4. criação/bloqueio/redefinição de usuários;
5. isolamento entre dois tenants;
6. cliente pertencente à empresa correta;
7. extintor pertencente ao cliente e tenant corretos;
8. OS e itens com vínculo correto;
9. exclusão e restauração pela lixeira;
10. filtros de validade;
11. configuração de antecedência;
12. numeração concorrente das OS;
13. conexão read-only com banco CI;
14. backup, checksum e retenção;
15. paginação de sincronização;
16. reprocessamento de operação offline;
17. build e typecheck.

Use banco CI separado do banco comercial. Os testes devem ser determinísticos e resetáveis apenas quando a variável de ambiente de teste permitir explicitamente.

## 13. Scripts e critérios de entrega

Inclua estes scripts:

```json
{
  "dev": "NODE_ENV=development tsx watch server/_core/index.ts",
  "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "start": "NODE_ENV=production node dist/index.js",
  "check": "tsc --noEmit",
  "test": "vitest run",
  "test:ci": "node scripts/prepare-test-db.mjs && vitest run",
  "backup:db": "node scripts/backup-db.mjs",
  "restore:db": "node scripts/restore-db.mjs",
  "maintenance:db": "node scripts/maintenance-db.mjs",
  "cleanup:db": "node scripts/maintenance-db.mjs --skip-backup"
}
```

Antes de considerar concluído, execute:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm test
pnpm test:ci
```

Valide que:

- o login aparece corretamente em sessão anônima;
- o dashboard abre depois do login;
- o layout funciona em 375 px e desktop;
- o bundle não contém HMR, localhost, proxy de desenvolvimento ou marca antiga;
- nenhum arquivo contém “Efraim”, “Efrain”, OAuth, Forge, Manus ou storage proprietário;
- nenhum secret está versionado;
- a aplicação inicia com `pnpm start`;
- `system.health` responde sem autenticação;
- o endpoint de manutenção rejeita secret incorreto;
- os testes de isolamento passam;
- a numeração concorrente não duplica OS.

## 14. Entrega esperada da outra IA

Entregue:

1. código completo e executável;
2. schema Drizzle e migrações revisadas;
3. frontend responsivo e PWA;
4. API tRPC protegida;
5. autenticação própria;
6. modo offline paginado;
7. backup/restauração/manutenção;
8. Dockerfile e `docker-compose.yml`;
9. `.env.example` sem secrets reais;
10. testes automatizados;
11. README de execução local;
12. guia de migração para qualquer VPS/Docker;
13. relatório final com comandos executados, testes aprovados e limitações conhecidas.

Não pare em mockups ou pseudocódigo. Implemente a aplicação funcional de ponta a ponta, valide-a e corrija os erros encontrados antes de entregar.
