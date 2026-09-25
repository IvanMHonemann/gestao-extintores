# Handoff para outra IA ou conta

Este repositório é a fonte principal do código do Gestão de Extintores. O banco de produção fica fora do GitHub e deve continuar sendo acessado por `EXTERNAL_DATABASE_URL`; nunca copie os dados reais para commits.

## Primeiros passos

```bash
git clone https://github.com/IvanMHonemann/gestao-extintores.git
cd gestao-extintores
corepack enable
pnpm install --frozen-lockfile
cp config/env.example .env
```

Preencha os secrets somente no ambiente local ou no secret manager do novo host. Fora da Manus, mantenha `MANUS_INTEGRATIONS=false`.

## Conectar a uma nova conta ou repositório

Depois de instalar a GitHub CLI e autenticar com `gh auth login`, execute:

```bash
./scripts/git-connect.sh OWNER/REPOSITORY --private
```

O script não contém token, não imprime secrets e recusa executar quando há alterações não commitadas. Ele reutiliza o repositório existente ou cria um novo, configura o remote `github` e envia o branch atual.

## Validar e publicar uma alteração

```bash
./scripts/ci-local.sh
git add -A
git commit -m "feat: descreva a alteração"
git push github main
```

O GitHub Actions repete a validação no servidor. Após CI verde no `main`, a imagem Docker é publicada no GHCR. A hospedagem ainda precisa ser configurada para promover essa imagem; o push não altera o banco.

## Regras para a IA

Antes de editar, leia `README.md`, `PORTABILITY.md`, `OPERATIONS.md` e `DEPLOYMENT.md`. Preserve `drizzle/schema.ts` e as migrações. Faça backup antes de alterar schema. Nunca execute restauração destrutiva sem `ALLOW_DESTRUCTIVE_RESTORE=true` e confirmação explícita. Nunca coloque `.env`, URLs de banco, chaves, sessões, backups ou dados de clientes no Git.

## Contratos importantes

- Código: GitHub privado.
- Dados: MySQL/TiDB externo.
- Ambiente: `config/env.example`.
- Execução: `pnpm run build` e `pnpm start`, ou Docker Compose.
- CI: `.github/workflows/ci.yml`.
- Imagem: `.github/workflows/container.yml`.
- Smoke test read-only: `.github/workflows/database-smoke.yml`.
