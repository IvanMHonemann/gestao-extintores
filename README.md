# Gestão de Extintores

Sistema full-stack multiempresa para clientes, extintores, alertas e ordens de serviço.

## Stack

- Node.js 22, Express e tRPC
- React, Vite, Tailwind e PWA
- MySQL/TiDB com Drizzle e pool `mysql2`
- Autenticação comercial própria com sessões armazenadas por hash
- Backup local e storage remoto S3 compatível opcional

## Executar

```bash
corepack enable
pnpm install --frozen-lockfile
cp config/env.example .env
# preencha EXTERNAL_DATABASE_URL, JWT_SECRET e SCHEDULE_SECRET
pnpm run check
pnpm run build
pnpm start
```

O mesmo processo serve a API e o frontend. Também é possível executar com Docker:

```bash
docker compose up -d --build
```

## Testes

```bash
pnpm test
```

A suíte comercial isolada usa um banco CI dedicado:

```bash
ALLOW_TEST_DB_RESET=true EXTERNAL_DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL="$TEST_DATABASE_URL" pnpm test:ci
```

## Operação

- `EXTERNAL_DATABASE_URL`: banco MySQL/TiDB com TLS.
- `JWT_SECRET`: segredo longo para cookies e sessões.
- `SCHEDULE_SECRET`: protege o endpoint de manutenção diária.
- `S3_*`: S3, R2, MinIO ou outro storage compatível para backups persistentes.
- `ALERT_WEBHOOK_URL`: webhook opcional para alertas.
- `VITE_GOOGLE_MAPS_API_KEY`: mapa opcional; sem chave o sistema continua funcionando.

Consulte `PORTABILITY.md`, `OPERATIONS_AUTOMATION.md` e `DATABASE_MIGRATION_GUIDE.md` antes de migrar banco ou hospedagem. Nunca versione `.env`, credenciais, tokens, backups ou dados de clientes.
