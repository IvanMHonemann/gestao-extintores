# Operação automática e escalabilidade

## Componentes portáveis

- **Banco:** pool MySQL/TiDB com limite, fila, timeout, keep-alive e log de consultas lentas.
- **Numeração de OS:** sequência transacional por empresa e retry contra conflito.
- **Backup:** arquivo local com checksum, retenção e upload opcional para S3/R2/MinIO.
- **Alertas:** webhook HTTP genérico configurado por `ALERT_WEBHOOK_URL`.
- **Agendamento:** endpoint protegido por `SCHEDULE_SECRET`; o cron pode ser executado por qualquer provedor.
- **Limpeza:** remove lixeira expirada, sessões vencidas e operações offline antigas.
- **Offline:** snapshots paginados, fila com tentativas e tela de status.

## Cron diário

Configure um job externo para executar diariamente:

```bash
curl --fail-with-body -X POST "$APP_URL/api/scheduled/database-maintenance" \
  -H "Authorization: Bearer $SCHEDULE_SECRET"
```

O endpoint retorna HTTP 401 sem secret, HTTP 500 quando backup/limpeza falha e HTTP 200 com o resultado da execução. Não existe dependência de heartbeat proprietário.

## Storage remoto

Configure `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` para AWS S3, Cloudflare R2, MinIO, Backblaze ou outro serviço compatível. Use uma credencial restrita ao prefixo de backups. Nunca publique `S3_SECRET_ACCESS_KEY` no frontend.

## Testes

```bash
ALLOW_TEST_DB_RESET=true EXTERNAL_DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL="$TEST_DATABASE_URL" pnpm test:ci
```

O banco CI deve ser separado do banco da aplicação e conter somente fixtures determinísticas. O comando completo deve permanecer verde antes de cada release.
