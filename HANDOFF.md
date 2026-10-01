# Handoff operacional independente

## Arquitetura

Aplicação full-stack multiempresa para clientes, extintores, alertas e ordens de serviço. O login é próprio da aplicação, com sessões armazenadas por hash. O frontend e a API são servidos pelo mesmo processo Node.js.

## Arquivos principais

- `client/src/App.tsx` — rotas e controle de sessão.
- `client/src/pages/` — telas.
- `server/routers.ts` — contrato tRPC.
- `server/memberAuth.ts` — login, recuperação e sessões.
- `server/db.ts` — consultas e pool Drizzle.
- `drizzle/schema.ts` — fonte de verdade do banco.
- `server/storage.ts` — storage S3 compatível.
- `scripts/backup-db.mjs` e `scripts/restore-db.mjs` — proteção de dados.
- `PORTABILITY.md` — migração de hospedagem.

## Execução

```bash
corepack enable
pnpm install --frozen-lockfile
cp config/env.example .env
pnpm run check
pnpm run build
pnpm start
```

## Ambiente

Obrigatórios: `EXTERNAL_DATABASE_URL`, `JWT_SECRET`, `SCHEDULE_SECRET`, `NODE_ENV` e `PORT`.

Opcionais: `S3_*` para backup remoto, `ALERT_WEBHOOK_URL` para alertas e `VITE_GOOGLE_MAPS_API_KEY` para mapas.

## Release e manutenção

```bash
pnpm test
pnpm run build
docker compose up -d --build
```

Use `pnpm test:ci` com um banco CI separado. Faça backup e revise o SQL antes de qualquer migração. Configure um cron externo para `/api/scheduled/database-maintenance` usando `Authorization: Bearer $SCHEDULE_SECRET`.

Não copie dados reais, backups, cookies, hashes ou secrets para o repositório. A senha do banco compartilhada anteriormente deve ser rotacionada.
