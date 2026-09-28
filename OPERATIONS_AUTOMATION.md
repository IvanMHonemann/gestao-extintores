# Operação automática e escalabilidade

## Banco e numeração de OS

A criação de OS reserva o próximo número dentro de uma transação, usando a chave única lógica `system_settings(accountId, settingKey)` com `settingKey=order_sequence`. A atualização é atômica por empresa e a inserção repete até três vezes quando o banco reporta conflito de chave duplicada. O endpoint `orders.nextNumber` continua sendo apenas uma prévia; a reserva definitiva ocorre no `orders.create`.

O servidor usa pool MySQL/TiDB com `DB_CONNECTION_LIMIT`, `DB_QUEUE_LIMIT`, `DB_CONNECT_TIMEOUT_MS` e keep-alive. Consultas que excederem `DB_SLOW_QUERY_MS` aparecem nos logs como `[Database] Slow query`.

## Backup diário e retenção

Nunca grave backups no repositório. Configure uma pasta privada e, quando possível, uma segunda pasta em outro volume ou provedor:

```bash
BACKUP_DIR=/var/backups/gestao-extintores/daily
BACKUP_COPY_DIR=/mnt/backup-externo/gestao-extintores
BACKUP_RETENTION_DAYS=14
pnpm maintenance:db
```

`maintenance:db` faz o backup antes da limpeza, grava um checksum `.sha256`, verifica o JSON recém-criado e remove arquivos fora da retenção. A rotina também remove snapshots vencidos da lixeira e sessões expiradas. Se o backup falhar, o processo termina com código diferente de zero e a limpeza não é executada.

O projeto também possui um heartbeat diário `daily-database-maintenance` (02:15 UTC) que chama `/api/scheduled/database-maintenance`. O callback aceita somente uma sessão cron válida do WebDev. Em runtime serverless, o fallback é `/tmp/gestao-extintores-backups/daily`, que é apenas temporário; configure `BACKUP_DIR` para um volume persistente assim que ele estiver disponível.

Para uma migração manual, sempre execute antes:

```bash
pnpm backup:db -- --output=/var/backups/gestao-extintores/pre-migration.json --retention-days=30
```

A restauração permanece protegida por `ALLOW_DESTRUCTIVE_RESTORE=true`; depois da restauração, faça uma verificação read-only e um teste de login.

### Agendamento externo

Em hospedagem com cron, use um usuário sem permissões desnecessárias e `MAILTO` para alertar falhas:

```cron
MAILTO=operacoes@exemplo.com
15 2 * * * cd /srv/gestao-extintores && /usr/bin/flock -n /tmp/gestao-extintores-maintenance.lock /usr/bin/pnpm maintenance:db >> /var/log/gestao-extintores-maintenance.log 2>&1
```

O backup externo deve estar em volume diferente do banco. Periodicamente, restaure uma cópia em ambiente de teste; um backup que nunca foi restaurado não deve ser considerado validado.

## Limpeza automática

A rotina remove:

- itens da `trash_items` cujo `expiresAt` já passou;
- sessões vencidas de membros e administradores;
- operações offline locais antigas: falhas com mais de 30 dias e pendências com mais de 90 dias, no navegador do tenant.

A limpeza é idempotente e pode ser executada novamente sem apagar dados válidos.

## Offline para contas grandes

O endpoint autenticado `offline.snapshot` sincroniza páginas de 10 a 100 registros, com padrão de 50, e retorna `totals`/`hasMore`. A Home usa a primeira página para o cache offline; consultas paginadas continuam sendo usadas para a visualização online. O IndexedDB preserva páginas já cacheadas em vez de apagar todo o tenant a cada snapshot.

A fila offline agora registra tentativas, último erro e horário da tentativa. A tela `/sync-status` permite:

- ver conectividade, pendências e falhas;
- reprocessar uma operação com falha;
- descartar uma operação inválida;
- identificar que o cache é limitado a páginas recentes.

Antes de trabalhar offline em uma conta grande, carregue as páginas necessárias enquanto estiver conectado. O sistema não deve ser configurado para baixar milhares de registros de uma vez.
