# Gestão de Extintores

Sistema full-stack para gestão multiempresa de clientes, extintores, alertas e ordens de serviço.

## Executar localmente

```bash
corepack enable
pnpm install --frozen-lockfile
cp config/env.example .env
# preencha EXTERNAL_DATABASE_URL e JWT_SECRET
pnpm run check
pnpm run build
pnpm start
```

Para usar Docker, consulte `docker-compose.yml`. Para migrar para outra IA, conta ou hospedagem, comece por `PORTABILITY.md`, `HANDOFF.md`, `AI_HANDOFF.md`, `DATABASE_MIGRATION_GUIDE.md` e `OPERATIONS.md`.

Para conectar este código a outra conta ou repositório GitHub sem expor tokens, autentique a GitHub CLI e execute `./scripts/git-connect.sh OWNER/REPOSITORY --private`. Para validar antes do push, execute `./scripts/ci-local.sh`. O guia completo para outra IA está em `AI_HANDOFF.md`.


Use primeiro o prompt operacional [`PROMPT-MIGRACAO-IA.md`](PROMPT-MIGRACAO-IA.md) ao transferir o projeto para outra conta, IA ou hospedagem.
## Banco de dados

O runtime prioriza `EXTERNAL_DATABASE_URL` e usa `DATABASE_URL` apenas como fallback. O schema vive em `drizzle/schema.ts`; as migrações futuras devem ser geradas e revisadas com Drizzle.

Antes de mudanças de infraestrutura, faça um backup:

```bash
pnpm backup:db -- --output=backups/pre-change.json
```

## Segurança

Não versionar `.env`, URLs completas de banco, chaves S3 ou tokens. O perfil não secreto e o procedimento de configuração estão em `DATABASE_MIGRATION_GUIDE.md`; a senha deve ser configurada somente no secret manager. A senha do banco compartilhada durante a configuração deve ser rotacionada. Fora da Manus, mantenha `MANUS_INTEGRATIONS=false`.
