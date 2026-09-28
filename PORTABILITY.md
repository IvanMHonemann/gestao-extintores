# Portabilidade do Gestão de Extintores

## Objetivo

Este projeto pode ser executado fora da Manus com **Node.js 22, pnpm, Docker e um banco MySQL/TiDB compatível**. O login comercial é próprio da aplicação; não depende de Manus OAuth quando `MANUS_INTEGRATIONS=false`.

## Inventário de dependências

| Área | Estado | Como migrar |
|---|---|---|
| Banco | TiDB Cloud/MySQL via Drizzle + `mysql2` | Configurar `EXTERNAL_DATABASE_URL` apontando para o schema `test` com TLS; fazer backup, revisar SQL e aplicar `pnpm exec drizzle-kit push --strict`; validar com `pnpm exec vitest run server/external-db.test.ts` |
| Autenticação comercial | Própria (`member_accounts`, `platform_admins`, sessões com hash) | Não depende da Manus; preservar tabelas e `JWT_SECRET` apenas se outros cookies forem usados |
| Frontend/API | React, Vite, Express, tRPC | Executar `pnpm install --frozen-lockfile`, `pnpm run build`, `pnpm start` |
| Arquivos | Helper legado usa Forge/S3 da Manus | O produto atual não usa upload no fluxo principal; para arquivos futuros, configurar S3 compatível e substituir `server/storage.ts` |
| Mapas | Proxy de mapas da Forge por padrão | Fornecer `VITE_GOOGLE_MAPS_API_KEY` e trocar o proxy em `client/src/components/Map.tsx`, ou manter o proxy opcional |
| IA/notificações | Helpers opcionais do scaffold (`server/_core/llm.ts`, `notification.ts`, `imageGeneration.ts`) | Não são usados pelo fluxo comercial atual; substituir por APIs do novo provedor somente se forem ativados |
| OAuth Manus | Scaffold legado | Desligado fora da Manus; rotas só são registradas com `MANUS_INTEGRATIONS=true` |
| Hosting | WebDev/Manus | `Dockerfile` e `docker-compose.yml` permitem rodar em VPS, Render, Railway, Fly.io, Cloud Run, ECS ou Kubernetes |

## Migração rápida para outra hospedagem

1. Exporte o repositório Git completo, incluindo `drizzle/schema.ts`, `drizzle/0000_shallow_leo.sql`, `server/`, `client/`, `shared/`, `package.json` e `pnpm-lock.yaml`.
2. Crie um `.env` a partir de [`config/env.example`](config/env.example). Nunca faça commit do `.env`.
3. Aponte `EXTERNAL_DATABASE_URL` para o banco atual, schema `test` (`gateway01.sa-east-1.prod.aws.tidbcloud.com:4000`) e mantenha TLS validado. Não use `sys` e não rode migrações sem backup.
4. Instale e valide:
   ```bash
   corepack enable
   pnpm install --frozen-lockfile
   pnpm run check
   pnpm run build
   pnpm exec vitest run server/external-db.test.ts
   ```
5. Para uma mudança de schema, gere e revise o SQL antes de aplicar:
   ```bash
   pnpm exec drizzle-kit generate
   pnpm exec drizzle-kit push --strict
   ```
   Não use `pnpm db:push` automaticamente: as migrações históricas incluem transformações de dados e não são uma baseline limpa para banco vazio.
6. Inicie:
   ```bash
   NODE_ENV=production pnpm start
   ```
   ou:
   ```bash
   docker compose up -d --build
   ```
7. Teste o login com uma conta existente. Não crie dados demonstrativos em produção.

## Backup antes de trocar de plataforma

Backup completo, sem expor a URL no terminal:

```bash
mkdir -p backups
pnpm backup:db -- --output=backups/pre-migration.json
```

Backup somente do schema:

```bash
pnpm backup:db -- --schema-only --output=backups/schema.json
```

Restauração normal:

```bash
pnpm restore:db -- --input=backups/pre-migration.json
```

Restauração destrutiva exige duas confirmações explícitas:

```bash
ALLOW_DESTRUCTIVE_RESTORE=true pnpm restore:db -- --input=backups/pre-migration.json --replace
```

Guarde backups fora do repositório, com criptografia e controle de acesso. A senha do banco compartilhada durante esta tarefa deve ser rotacionada.

## Checklist de troca de conta/IA

- [ ] Conta nova tem acesso ao repositório e ao banco.
- [ ] Secrets foram cadastrados no novo host, sem entrar no Git.
- [ ] `EXTERNAL_DATABASE_URL` aponta para o mesmo banco.
- [ ] `JWT_SECRET` foi preservado ou sessões foram conscientemente invalidadas.
- [ ] `MANUS_INTEGRATIONS=false` fora da Manus.
- [ ] Build e teste de conexão passaram.
- [ ] Login com conta real passou.
- [ ] Backup recente foi testado em uma cópia do banco.
- [ ] Domínio, TLS, SMTP/notificações e storage foram reconfigurados, se usados.

## Regras para futuras IAs/agentes

- Não executar `DROP`, `TRUNCATE` ou migração destrutiva sem backup e confirmação explícita.
- Não inserir seed/demo no banco de produção.
- Não colocar URLs de banco, senhas ou chaves em arquivos versionados.
- Preferir `EXTERNAL_DATABASE_URL` a `DATABASE_URL`; o primeiro é o contrato portátil do projeto.
- Manter o schema Drizzle e `drizzle/0000_shallow_leo.sql` versionados juntos.
