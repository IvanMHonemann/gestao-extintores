# Handoff — Gestão de Extintores

## O que este projeto é

Aplicação full-stack para gestão de empresas, clientes, extintores, alertas de vencimento e ordens de serviço. Multiempresa com isolamento por `companyId/accountId`.

## Arquivos de entrada

- `client/src/App.tsx` — rotas e controle de sessão.
- `client/src/pages/` — telas.
- `server/routers.ts` — contrato tRPC.
- `server/memberAuth.ts` — login, recuperação, sessões e criação de empresas.
- `server/db.ts` — consultas e mutações Drizzle.
- `drizzle/schema.ts` — fonte de verdade do banco.
- `drizzle/0000_shallow_leo.sql` — migração inicial versionada.
- `PORTABILITY.md` — procedimento de troca de host.
- `Dockerfile` / `docker-compose.yml` — execução fora da Manus.
- `scripts/backup-db.mjs` / `scripts/restore-db.mjs` — proteção de dados.

## Estado conhecido

- Login comercial próprio e banco externo configurado.
- `MANUS_INTEGRATIONS` pode ser `false` fora da Manus.
- `EXTERNAL_DATABASE_URL` é priorizada pelo runtime e pelo Drizzle.
- Build: `pnpm run check && pnpm run build`.
- Teste de conexão: `pnpm exec vitest run server/external-db.test.ts`.
- Testes de negócio que esperam registros demonstrativos não devem ser executados contra produção vazia; use uma cópia do banco ou fixtures isoladas.

## Contrato mínimo de ambiente

Obrigatório:

- `EXTERNAL_DATABASE_URL`
- `JWT_SECRET`
- `NODE_ENV`
- `PORT`

Opcional:

- `MANUS_INTEGRATIONS` — `false` fora da Manus.
- `S3_*` — para storage compatível.
- `VITE_GOOGLE_MAPS_API_KEY` — para mapas sem proxy Manus.

## Riscos e próximos trabalhos

1. **Storage:** `server/storage.ts` ainda tem implementação Forge/S3 da Manus. O fluxo atual não depende dela; substituir antes de adicionar upload de documentos.
2. **Mapas:** `client/src/components/Map.tsx` usa proxy Forge por padrão. Criar um provider direto Google Maps ou Leaflet antes de depender de mapas fora da Manus.
3. **Scaffold legado:** `server/_core/llm.ts`, `notification.ts`, `dataApi.ts`, `heartbeat.ts`, `oauth.ts` e `sdk.ts` são compatibilidade/infra opcionais. Não remover sem verificar imports.
4. **Observabilidade:** configurar logs, métricas, alertas e TLS no novo host.
5. **Segredos:** rotacionar a senha do banco que foi exposta nesta conversa.
