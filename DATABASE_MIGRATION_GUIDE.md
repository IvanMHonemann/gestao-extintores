# Guia de banco e migrações — Gestão de Extintores

## Contrato do banco

A aplicação usa MySQL/TiDB externo por `EXTERNAL_DATABASE_URL`. A URL completa e a senha ficam somente no secret manager. O código aplica TLS validado (`rejectUnauthorized: true`) no runtime, backup e Drizzle Kit.

O schema de produção atual é escolhido pelo administrador da implantação; não use schemas de sistema. O banco CI é separado e deve ser usado somente por `pnpm test:ci`.

## Configuração mínima

```dotenv
EXTERNAL_DATABASE_URL=mysql://usuario:senha@host:4000/gestao_extintores
JWT_SECRET=segredo-longo-e-aleatorio
SCHEDULE_SECRET=segredo-longo-para-cron
```

## Migração segura

1. Confirme o destino sem imprimir a URL:
   ```bash
   printenv | cut -d= -f1 | grep -E '^(EXTERNAL_DATABASE_URL|JWT_SECRET|SCHEDULE_SECRET)$' | sort
   ```
2. Faça backup fora do repositório:
   ```bash
   umask 077
   mkdir -p "$HOME/.private-backups/gestao-extintores"
   pnpm backup:db -- --output="$HOME/.private-backups/gestao-extintores/pre-migration.json"
   ```
3. Edite `drizzle/schema.ts` e gere o SQL:
   ```bash
   pnpm exec drizzle-kit generate
   ```
4. Leia integralmente o SQL. Pare se houver `DROP`, `TRUNCATE`, remoção de dados ou mudança não planejada.
5. Aplique somente após revisão:
   ```bash
   pnpm exec drizzle-kit push --strict
   ```
6. Valide:
   ```bash
   pnpm run check
   pnpm run build
   pnpm test
   ```

Nunca aplique migrations históricas em sequência por tentativa e erro contra um banco vazio. Para uma nova instalação, crie uma baseline revisada ou use o schema atual com aprovação explícita.

## Backup e restauração

```bash
pnpm backup:db -- --output=/var/backups/gestao-extintores/pre-change.json
pnpm restore:db -- --input=/var/backups/gestao-extintores/pre-change.json
```

Restauração destrutiva exige backup independente e autorização explícita. Nunca coloque o JSON no Git, em imagem Docker ou em anexos públicos.

## Segurança

- Rotacione credenciais que tenham sido expostas.
- Use usuário de banco com privilégios mínimos no runtime.
- Use credencial separada para CI e backup quando possível.
- Não execute seed demonstrativo em produção.
- Teste restauração periodicamente em banco isolado.
