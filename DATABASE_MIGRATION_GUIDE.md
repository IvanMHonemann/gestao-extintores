# Guia de banco e migrações — Gestão de Extintores

Este arquivo é a referência operacional para outra conta, hospedagem ou IA trabalhar no banco sem descobrir a arquitetura por tentativa e erro.

## Banco conectado atualmente

O projeto usa um banco MySQL/TiDB externo. Os dados não ficam no GitHub e a senha nunca deve ser colocada neste arquivo.

| Item | Valor não secreto |
|---|---|
| Provedor | TiDB Cloud |
| Host | `gateway01.sa-east-1.prod.aws.tidbcloud.com` |
| Porta | `4000` |
| Schema/banco da aplicação | `test` |
| Transporte | TLS obrigatório, com validação do certificado |
| Secret usado pelo projeto | `EXTERNAL_DATABASE_URL` |

A URL completa deve ser cadastrada somente no secret manager do ambiente. Ela deve apontar para o schema `/test`, não para `/sys`:

```dotenv
# Exemplo estrutural; nunca commitar a senha ou a URL real
EXTERNAL_DATABASE_URL=mysql://<usuario>:<senha>@gateway01.sa-east-1.prod.aws.tidbcloud.com:4000/test
```

O código força TLS com `rejectUnauthorized: true` em:

- `server/db.ts`, no acesso da aplicação;
- `scripts/backup-db.mjs`, nos backups;
- `drizzle.config.ts`, nas operações do Drizzle Kit.

Não é necessário colocar a senha, certificados ou uma URL completa em arquivos versionados. Em outra hospedagem, preserve a validação TLS equivalente.

## Estado atual do schema

O schema `test` foi inicializado sem seed e contém as 12 tabelas definidas em `drizzle/schema.ts`:

```text
clients
companies
extinguishers
member_accounts
member_sessions
platform_admins
platform_sessions
service_order_items
service_orders
system_settings
trash_items
users
```

Não executar `server/seed.ts` em produção. Ele contém dados demonstrativos e CPFs/CNPJs fictícios para desenvolvimento.

O login comercial é próprio da aplicação. A conta inicial de `platform_admin` já foi criada fora do código; nunca registrar a senha neste repositório.

## Configuração mínima em uma nova conta/hospedagem

1. Importe o repositório privado `IvanMHonemann/gestao-extintores`.
2. Configure no secret manager:
   - `EXTERNAL_DATABASE_URL`: URL do TiDB apontando para `/test` ou para o schema de produção escolhido explicitamente;
   - `JWT_SECRET`: segredo longo para os cookies da aplicação;
   - `MANUS_INTEGRATIONS=false` quando a hospedagem não for Manus.
3. Instale e valide:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run build
pnpm exec vitest run server/external-db.test.ts
pnpm exec vitest run server/auth.logout.test.ts server/memberAuth.test.ts
```

4. Teste, nesta ordem, uma conta real e os fluxos principais:
   - login do administrador geral;
   - seleção de empresa ativa;
   - criação de cliente;
   - criação de extintor;
   - criação de ordem de serviço;
   - recarga da tela e conferência dos dados;
   - impressão do documento.

## Fluxo obrigatório antes de qualquer migração

### 1. Confirmar o alvo sem expor secrets

```bash
# Confirma somente a presença do secret; não imprima o valor
printenv | cut -d= -f1 | grep -E '^(EXTERNAL_DATABASE_URL|DATABASE_URL|JWT_SECRET)$' | sort
```

Confirme que `EXTERNAL_DATABASE_URL` aponta para o schema de aplicação correto. Nunca use `sys` como banco da aplicação no TiDB Cloud; neste projeto, o schema conectado é `test`.

### 2. Validar conexão em modo read-only

```bash
pnpm exec vitest run server/external-db.test.ts
```

O teste deve executar somente uma consulta leve. Se falhar, pare e corrija o secret/TLS antes de continuar.

### 3. Fazer backup fora do repositório

Use um diretório privado, com permissões restritas e retenção controlada:

```bash
set -euo pipefail
backup_dir="$HOME/.private-backups/gestao-extintores"
umask 077
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
output="$backup_dir/pre-migration-$(date +%Y%m%d%H%M%S).json"
pnpm backup:db -- --output="$output"
stat -c 'backup=%n tamanho=%s bytes modo=%a' "$output"
```

Para uma alteração apenas estrutural, ainda prefira registrar um backup completo antes da mudança. Nunca coloque o arquivo `json` no GitHub, no diretório de publicação ou em anexos públicos.

### 4. Comparar o schema real com o código

```bash
pnpm exec drizzle-kit pull
```

Leia o SQL gerado antes de executar qualquer alteração. Pare se aparecer `DROP`, `TRUNCATE`, `DELETE`, mudança destrutiva de coluna ou alteração de dados que não tenha sido planejada.

### 5. Gerar e revisar a alteração

Depois de editar `drizzle/schema.ts`:

```bash
pnpm exec drizzle-kit generate
```

Leia integralmente o novo SQL em `drizzle/`. Não aplique uma migração que dependa de tabelas ou dados que não existem no banco real.

### 6. Aplicar somente após revisão e autorização

Para o banco atual, vazio ou já alinhado ao schema, o fluxo interativo recomendado é:

```bash
pnpm exec drizzle-kit push --strict
```

Na confirmação interativa, aprove somente mudanças estruturais previamente revisadas. Não use `--force` para silenciar alertas de perda de dados.

O script `pnpm db:push` do projeto combina geração e migração histórica. Não use esse script automaticamente contra produção: os arquivos históricos `drizzle/0000`–`drizzle/0006` contêm transformações de dados, inserts de configuração e operações que não são uma baseline limpa para um banco vazio.

### 7. Validar depois da alteração

```bash
pnpm run check
pnpm run build
pnpm exec vitest run server/external-db.test.ts server/memberAuth.test.ts
```

Depois, confirme em modo read-only o número e os nomes das tabelas. Teste login e os fluxos de criação/consulta na prévia antes de publicar.

## Regras de segurança

- Nunca executar `DROP`, `TRUNCATE`, `DELETE` amplo ou restauração destrutiva sem backup e confirmação explícita.
- Nunca executar migração de produção sem validar o alvo do secret e TLS.
- Nunca executar seed/dados demonstrativos em produção.
- Nunca copiar senha, `.env`, token, cookie, hash de senha, backup ou dados de clientes para o Git.
- Nunca compartilhar a URL completa do banco em chat ou logs.
- Preferir `EXTERNAL_DATABASE_URL` a `DATABASE_URL`; esse é o contrato portátil do projeto.
- Se uma migração histórica parecer necessária, primeiro compare o schema real e produza uma baseline limpa revisada; não aplique os arquivos em sequência por tentativa e erro.
- O CI pode testar o código, mas não deve executar alteração de schema automaticamente contra produção.

## GitHub e nova conta

O repositório principal é `IvanMHonemann/gestao-extintores`. O GitHub guarda código e histórico; o TiDB guarda dados e o secret manager guarda credenciais.

```bash
git clone https://github.com/IvanMHonemann/gestao-extintores.git
cd gestao-extintores
corepack enable
pnpm install --frozen-lockfile
```

Antes de enviar alterações:

```bash
./scripts/ci-local.sh
git remote -v
git status --short
git add -A
git commit -m "descreva a alteração"
git push github main
```

Mantenha o repositório privado e nunca passe tokens ou senhas como argumentos de comandos.

## Diagnóstico rápido

Se o login falhar:

1. confirme que o servidor foi reiniciado após atualizar `EXTERNAL_DATABASE_URL`;
2. confirme que a URL aponta para `/test` ou para o schema de produção correto, nunca `/sys`;
3. execute `pnpm exec vitest run server/external-db.test.ts`;
4. valide em modo read-only se a conta existe e está ativa, sem imprimir `passwordHash`;
5. não redefina a senha nem crie outra conta sem autorização do proprietário.

Se uma OS mostrar sucesso mas não aparecer:

1. confirme que a empresa selecionada está ativa;
2. confirme que o cliente pertence à empresa;
3. recarregue a aba de OS;
4. verifique as chamadas `platform.data.createOrder` e `platform.data.orders`;
5. consulte o banco somente em modo read-only antes de alterar qualquer coisa.
