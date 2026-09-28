# Handoff para outra conta, IA ou hospedagem

Este repositório contém o código completo do Gestão de Extintores. A aplicação usa autenticação comercial própria, banco MySQL/TiDB externo e storage S3 compatível opcional para backups.

## Primeiros passos

```bash
git clone https://github.com/IvanMHonemann/gestao-extintores.git
cd gestao-extintores
corepack enable
pnpm install --frozen-lockfile
cp config/env.example .env
```

Preencha os secrets somente no secret manager da nova hospedagem. Nunca versione `.env`, URL completa do banco, chaves S3, tokens ou backups.

## Validação

```bash
pnpm run check
pnpm run build
pnpm test
```

Para a suíte comercial completa, use um banco CI separado e `pnpm test:ci`. Não execute o reset de fixtures contra o banco de produção.

## Contratos de ambiente

- `EXTERNAL_DATABASE_URL`: banco MySQL/TiDB com TLS.
- `JWT_SECRET`: assinatura e proteção de sessão.
- `SCHEDULE_SECRET`: autenticação do endpoint de manutenção.
- `S3_*`: storage remoto compatível para backups persistentes.
- `ALERT_WEBHOOK_URL`: alerta opcional de falha.
- `VITE_GOOGLE_MAPS_API_KEY`: mapa opcional, diretamente do Google.

## Operação

O servidor é iniciado com `pnpm start` ou pelo Docker. Configure HTTPS no proxy reverso, health check em `/api/trpc/system.health` e um cron externo para `/api/scheduled/database-maintenance`. Faça backup antes de migrações e teste a restauração periodicamente.

A aplicação não requer OAuth, APIs, cron, storage ou ambiente de execução de fornecedor específico.
