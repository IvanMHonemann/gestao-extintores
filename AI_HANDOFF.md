
## Billing SaaS

A arquitetura de planos e assinaturas está documentada em `SUBSCRIPTIONS.md`. A assinatura pertence à empresa, e o backend calcula o acesso por `getSubscriptionAccess(companyId)`. Empresas sem assinatura configurada permanecem compatíveis e não são bloqueadas automaticamente. Antes de aplicar `drizzle/0007_wet_hammerhead.sql` em produção, faça backup, revise o SQL e valide em banco CI separado.
