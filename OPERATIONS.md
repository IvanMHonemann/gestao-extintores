# Operação independente

## Deploy

```bash
cp config/env.example .env
# edite .env sem comitar
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm start
```

## Docker

```bash
docker compose up -d --build
docker compose logs -f app
```

## Saúde

A aplicação expõe o procedimento público `system.health` pelo endpoint tRPC. O compose usa esse procedimento no healthcheck. Em um proxy reverso, encaminhe `/api/*` e o frontend para a porta 3000.

## Atualizações de schema

1. Faça backup.
2. Atualize `drizzle/schema.ts`.
3. Gere a migração:
   ```bash
   pnpm exec drizzle-kit generate
   ```
4. Revise o SQL gerado.
5. Aplique:
   ```bash
   pnpm exec drizzle-kit migrate
   ```
6. Rode check/build e teste de conexão.

## Segurança

- Use HTTPS para proteger cookies.
- Armazene secrets no secret manager do host.
- Não logue `EXTERNAL_DATABASE_URL`.
- Restrinja o banco por rede/IP quando possível.
- Faça backup automático diário e teste restauração mensalmente.
- Rotacione credenciais após qualquer compartilhamento acidental.
