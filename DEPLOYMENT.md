# CI/CD e publicação

## Validação

Todo pull request deve executar:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm run build
```

Nenhum workflow de CI deve escrever no banco comercial. O teste completo usa um banco CI separado e as fixtures de `scripts/prepare-test-db.mjs`.

## Container

O Dockerfile produz uma imagem Node 22 contendo o bundle compilado, scripts operacionais e migrações. A imagem não contém secrets, banco, backups ou dados reais.

```bash
docker build -t gestao-extintores:local .
docker run --env-file .env -p 3000:3000 gestao-extintores:local
```

## Variáveis do runtime

Configure no secret manager da hospedagem:

- `EXTERNAL_DATABASE_URL`
- `JWT_SECRET`
- `SCHEDULE_SECRET`
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `ALERT_WEBHOOK_URL`
- `VITE_GOOGLE_MAPS_API_KEY`, se mapas forem necessários

Nunca grave esses valores no Dockerfile, no compose ou no Git.

## Cron e health check

Configure um scheduler externo para chamar diariamente:

```bash
curl --fail-with-body -X POST "$APP_URL/api/scheduled/database-maintenance" \
  -H "Authorization: Bearer $SCHEDULE_SECRET"
```

Use HTTPS no proxy reverso e monitore o status HTTP. O endpoint de saúde tRPC é `system.health`.

## Migrações

1. Faça backup privado.
2. Gere e revise o SQL com `pnpm exec drizzle-kit generate`.
3. Aplique com `pnpm exec drizzle-kit push --strict` após revisão.
4. Execute testes, build e smoke test de banco.
5. Promova a imagem no host.

O CI não executa `db:push`, `drizzle-kit migrate`, `DROP`, `TRUNCATE` ou restauração destrutiva contra produção.
