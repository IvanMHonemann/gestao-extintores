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

O banco TiDB atual usa o schema `test` no host `gateway01.sa-east-1.prod.aws.tidbcloud.com:4000`. A URL fica somente em `EXTERNAL_DATABASE_URL` e o código exige TLS com validação de certificado. Nunca use `sys` para as tabelas da aplicação.

1. Valide o secret e execute o teste read-only:
   ```bash
   pnpm exec vitest run server/external-db.test.ts
   ```
2. Faça backup fora do repositório, com modo 600.
3. Atualize `drizzle/schema.ts`.
4. Gere a migração:
   ```bash
   pnpm exec drizzle-kit generate
   ```
5. Revise integralmente o SQL gerado. Pare diante de `DROP`, `TRUNCATE`, `DELETE` amplo ou alteração de dados não planejada.
6. Aplique somente após revisão e autorização:
   ```bash
   pnpm exec drizzle-kit push --strict
   ```
   Não use `pnpm db:push` automaticamente: a cadeia histórica pode conter transformações de dados e não é uma baseline limpa para banco vazio.
7. Rode check/build, testes e validação read-only do schema.

## Segurança

- Use HTTPS para proteger cookies.
- Armazene secrets no secret manager do host.
- Não logue `EXTERNAL_DATABASE_URL`.
- Restrinja o banco por rede/IP quando possível.
- Faça backup automático diário e teste restauração mensalmente.
- Rotacione credenciais após qualquer compartilhamento acidental.
