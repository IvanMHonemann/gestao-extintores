# Portabilidade do Gestão de Extintores

## Objetivo

O projeto é uma aplicação Node.js independente: React/Vite no frontend, Express/tRPC no servidor, autenticação comercial própria e MySQL/TiDB via Drizzle. Não depende de OAuth, APIs, cron, storage ou runtime de um provedor específico.

## Dependências externas explícitas

| Serviço | Obrigatório | Configuração |
|---|---:|---|
| Node.js 22 + pnpm | Sim | `pnpm install --frozen-lockfile` |
| MySQL/TiDB compatível | Sim | `EXTERNAL_DATABASE_URL` com TLS |
| `JWT_SECRET` | Sim | Segredo longo e aleatório |
| S3/R2/MinIO compatível | Para backup remoto | Variáveis `S3_*`; o backup local continua disponível |
| Google Maps | Não | `VITE_GOOGLE_MAPS_API_KEY`; sem chave, o mapa mostra estado desativado |
| Webhook de alertas | Não | `ALERT_WEBHOOK_URL`; compatível com Slack, Discord, n8n ou serviço próprio |
| Cron externo | Recomendado | POST para `/api/scheduled/database-maintenance` com `Authorization: Bearer $SCHEDULE_SECRET` |

Nenhum serviço proprietário é necessário para login, API, sessões, banco, backup ou manutenção.

## Execução local ou VPS

```bash
corepack enable
pnpm install --frozen-lockfile
cp config/env.example .env
pnpm run check
pnpm run build
NODE_ENV=production pnpm start
```

O servidor escuta `PORT` (padrão 3000). O frontend é servido pelo mesmo processo; não há necessidade de Node separado para o frontend.

## Docker

```bash
docker compose up -d --build
```

Configure os secrets no ambiente do host, nunca no `Dockerfile`, `docker-compose.yml` ou Git. O container não contém banco, dados, backups nem chaves.

## Banco e migrações

1. Configure `EXTERNAL_DATABASE_URL` com TLS validado.
2. Faça backup privado antes de qualquer alteração.
3. Gere e revise o SQL:
   ```bash
   pnpm exec drizzle-kit generate
   ```
4. Aplique somente após revisão:
   ```bash
   pnpm exec drizzle-kit push --strict
   ```
5. Valide:
   ```bash
   pnpm run check
   pnpm run build
   pnpm test
   ```

Não use schemas de sistema (`sys`) para a aplicação e não execute reset/seed demonstrativo em produção.

## Backups e manutenção

Backup manual:

```bash
pnpm backup:db -- --output=/var/backups/gestao-extintores/pre-migration.json
```

Manutenção diária:

```bash
pnpm maintenance:db
```

O callback HTTP pode ser agendado por cron, GitHub Actions, GitLab CI, Kubernetes CronJob, systemd timer ou qualquer scheduler:

```bash
curl -fsS -X POST https://seu-dominio.example/api/scheduled/database-maintenance \
  -H "Authorization: Bearer $SCHEDULE_SECRET"
```

Quando `S3_*` estiver configurado, o backup é enviado para o bucket compatível. `ALERT_WEBHOOK_URL` recebe alertas de falha. Em runtime efêmero, use S3/R2; `BACKUP_DIR` local não substitui armazenamento persistente.

## Suíte isolada

A suíte completa usa um banco dedicado, nunca o banco comercial:

```bash
export TEST_DATABASE_URL='mysql://usuario:senha@host:4000/gestao_extintores_ci?tls=true'
ALLOW_TEST_DB_RESET=true EXTERNAL_DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL="$TEST_DATABASE_URL" pnpm test:ci
```

O utilitário recusa os schemas `test` e `sys` como banco de fixtures e exige autorização explícita para resetar um banco CI já existente.

## Migração para outro host

- Copie o repositório e o lockfile.
- Cadastre `EXTERNAL_DATABASE_URL`, `JWT_SECRET`, `SCHEDULE_SECRET` e os `S3_*` fora do Git.
- Execute `pnpm run check`, `pnpm run build` e `pnpm test`.
- Configure TLS no proxy reverso e HTTPS no domínio.
- Configure o cron externo e execute uma manutenção manual.
- Teste login, criação de empresa, isolamento entre tenants, emissão simultânea de OS e restauração de backup.

A única informação que não deve ser copiada para o repositório é o conteúdo dos secrets e os dados reais do banco.
