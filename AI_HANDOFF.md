# Handoff para outra IA ou conta

Este repositório é a fonte principal do código do Gestão de Extintores. O banco de produção fica fora do GitHub e deve continuar sendo acessado por `EXTERNAL_DATABASE_URL`; nunca copie os dados reais para commits.

## Primeiros passos

> Para uma migração completa para outra conta ou IA, copie o prompt operacional de [`PROMPT-MIGRACAO-IA.md`](PROMPT-MIGRACAO-IA.md). Ele reúne o fluxo de GitHub, banco, secrets, validações, publicação e as correções que não podem ser regressadas.

```bash
git clone https://github.com/IvanMHonemann/gestao-extintores.git
cd gestao-extintores
corepack enable
pnpm install --frozen-lockfile
cp config/env.example .env
```

Preencha os secrets somente no ambiente local ou no secret manager do novo host. Fora da Manus, mantenha `MANUS_INTEGRATIONS=false`.

### Conexão GitHub obrigatória em uma migração

Antes de editar o projeto em outra conta, confirme a origem do código:

```bash
gh auth login
git remote -v
```

O remote principal deve ser `https://github.com/IvanMHonemann/gestao-extintores.git`. Para uma nova cópia privada, use:

```bash
./scripts/git-connect.sh OWNER/REPOSITORY --private
```

Não coloque tokens nos arquivos, argumentos ou commits. O guia detalhado está em `DATABASE_MIGRATION_GUIDE.md`.

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

Antes de editar, leia `README.md`, `PORTABILITY.md`, `OPERATIONS.md`, `DEPLOYMENT.md` e `DATABASE_MIGRATION_GUIDE.md`. Preserve `drizzle/schema.ts` e as migrações. Faça backup antes de alterar schema. Nunca execute restauração destrutiva sem `ALLOW_DESTRUCTIVE_RESTORE=true` e confirmação explícita. Nunca coloque `.env`, URLs de banco, chaves, sessões, backups ou dados de clientes no Git.

O guia de banco contém apenas host, porta, schema e placeholders. A senha precisa ser rotacionada e cadastrada somente no secret manager da nova conta.

## Contratos importantes

- Código: GitHub privado.
- Dados: MySQL/TiDB externo.
- Ambiente: `config/env.example`.
- Execução: `pnpm run build` e `pnpm start`, ou Docker Compose.
- CI: `.github/workflows/ci.yml`.
- Imagem: `.github/workflows/container.yml`.
- Smoke test read-only: `.github/workflows/database-smoke.yml`.
