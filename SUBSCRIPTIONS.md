# Assinaturas e planos

## Princípios

- A assinatura pertence à **empresa/tenant**, nunca a um funcionário.
- `PLATFORM_ADMIN` é global e não depende de assinatura.
- Usuários da empresa herdam o acesso da assinatura do próprio tenant.
- Empresas existentes sem assinatura permanecem em modo de compatibilidade até que o administrador configure o primeiro plano.
- A autorização comercial é decidida no backend por `getSubscriptionAccess(companyId)`.

## Tabelas

- `plans`: catálogo de planos e limites configuráveis.
- `subscriptions`: período, status, tolerância e identificadores opcionais de provedor.
- `payments`: histórico imutável de cobranças e pagamentos.
- `subscription_events`: trilha de auditoria e base para webhooks idempotentes.

Os IDs internos continuam sendo as chaves primárias. IDs futuros do Asaas, Stripe ou outro gateway ficam em `providerSubscriptionId`, `providerPaymentId` e `referenceId`.

## Status e acesso

`TRIAL`, `ACTIVE` e `PAST_DUE` permitem acesso enquanto `currentPeriodEnd` não foi alcançado. Se existir `gracePeriodEndsAt` posterior ao vencimento, o estado calculado é `GRACE_PERIOD` e o acesso continua, com aviso visível. Depois da tolerância, ou nos estados `SUSPENDED` e `CANCELED`, as operações comerciais são bloqueadas. Os dados não são apagados e a tela **Minha assinatura** continua disponível.

O campo `daysRemaining` não é persistido; ele é calculado em tempo de consulta.

## Administração manual

O router `platform.billing` permite:

- criar e atualizar planos;
- consultar assinaturas e o estado efetivo de cada empresa;
- criar o primeiro período manualmente;
- renovar adicionando dias, sem perder o período restante de uma assinatura ainda ativa;
- suspender, reativar, cancelar e alterar plano;
- consultar pagamentos e eventos.

A interface está em `/admin/assinaturas`. A interface da empresa está em `/assinatura`.

## Migração

A migração `drizzle/0007_wet_hammerhead.sql` é aditiva e cria apenas as quatro tabelas de billing, seus índices e foreign keys. Ela deve ser revisada e aplicada em uma janela controlada, após backup:

```bash
pnpm exec drizzle-kit generate
# revisar drizzle/*.sql; não prosseguir diante de DROP/TRUNCATE
pnpm exec drizzle-kit push --strict
```

Não aplicar a migração contra `sys`, não usar o banco CI para dados comerciais e não executar reset de fixtures no banco de produção.

## Gateway futuro

`futureBillingProvider` define a interface conceitual para criar, atualizar, cancelar, consultar assinaturas, consultar pagamentos e processar webhooks. A etapa atual não exige API key e não realiza cobrança real. Um gateway futuro deve validar assinatura/origem do webhook, persistir o evento antes de processá-lo, usar `source + referenceId` para idempotência e liberar acesso somente depois da confirmação do evento do provedor.
