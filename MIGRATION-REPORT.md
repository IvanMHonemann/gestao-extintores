# Relatório de migração segura — Gestão de Extintores

**Data da validação:** 2026-09-28
**Origem analisada:** `/home/ubuntu/upload/gestao-extintores-main(1).zip`  
**Projeto WebDev:** `/home/ubuntu/gestao-extintores`

## Resumo executivo

O código foi importado para o projeto WebDev e conectado ao TiDB Cloud usando o secret `EXTERNAL_DATABASE_URL`, com TLS validado. A URL aponta para o schema de aplicação `test`; o schema de sistema `sys` foi rejeitado para uso da aplicação.

O schema atual foi aplicado ao banco vazio sem seed, criando as 12 tabelas definidas em `drizzle/schema.ts`. Foi criada uma única conta `platform_admin` autorizada pelo proprietário. Nenhuma empresa, cliente, extintor, ordem de serviço ou dado demonstrativo foi inserido.

## Estado do banco

- Provedor: TiDB Cloud.
- Host/porta não secretos: `gateway01.sa-east-1.prod.aws.tidbcloud.com:4000`.
- Schema da aplicação: `test`.
- Transporte: TLS com `rejectUnauthorized: true` no runtime, backup e Drizzle Kit.
- Tabelas confirmadas: 12.
- Backup preventivo realizado fora do repositório antes da criação do schema, com diretório 700 e arquivo 600.
- Nenhuma senha, URL completa, hash, cookie ou dado de cliente foi registrado neste relatório.

Tabelas confirmadas:

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

## Checklist de validação

- [x] Código importado para o projeto WebDev.
- [x] Secret `EXTERNAL_DATABASE_URL` configurado fora do código.
- [x] TLS validado na aplicação, backup e Drizzle Kit.
- [x] Conexão read-only aprovada por `server/external-db.test.ts`.
- [x] Banco `test` confirmado sem tabelas antes da inicialização.
- [x] Backup preventivo criado fora do repositório.
- [x] Schema atual aplicado com `pnpm exec drizzle-kit push --strict`.
- [x] 12 tabelas confirmadas após a aplicação.
- [x] Nenhum seed/dado demonstrativo executado.
- [x] Conta inicial `platform_admin` autorizada criada.
- [x] Login direto e endpoint real de login retornaram sucesso.
- [x] `pnpm run check` passou.
- [x] `pnpm run build` passou.
- [x] Testes de autenticação e conexão passaram.
- [x] Preview WebDev reiniciado após atualizar os secrets.
- [x] Checkpoint WebDev salvo após a validação.

## Regras para futuras migrações

1. Ler `DATABASE_MIGRATION_GUIDE.md`, `AI_HANDOFF.md`, `PORTABILITY.md`, `DEPLOYMENT.md` e `OPERATIONS.md` antes de editar.
2. Confirmar que `EXTERNAL_DATABASE_URL` aponta para o schema correto; no ambiente atual, é `/test`, nunca `/sys`.
3. Executar `pnpm exec vitest run server/external-db.test.ts`.
4. Criar backup privado fora do repositório antes de qualquer alteração.
5. Editar `drizzle/schema.ts`, executar `pnpm exec drizzle-kit generate` e revisar integralmente o SQL.
6. Parar diante de `DROP`, `TRUNCATE`, `DELETE` amplo ou alteração de dados não planejada.
7. Aplicar somente após autorização explícita com `pnpm exec drizzle-kit push --strict`.
8. Não usar `pnpm db:push` automaticamente: a cadeia histórica em `drizzle/0000`–`drizzle/0006` contém transformações de dados e não é uma baseline limpa para banco vazio.
9. Rodar check, build, testes e validação read-only depois da mudança.
10. Nunca executar `server/seed.ts` em produção.

## Bloqueios e observações remanescentes

- O secret temporário usado para o bootstrap da conta administrativa não é referenciado pelo código da aplicação; ele deve ser removido ou substituído pelo administrador no secret manager após o primeiro login.
- Testes de negócio que exigem empresas/clientes reais devem ser executados em uma cópia ou após cadastro explícito de dados reais, nunca por seed automático.
- O CI valida código e bundle, mas não deve alterar schema de produção automaticamente.
