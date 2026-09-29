
## Billing e assinaturas

A migração `drizzle/0007_wet_hammerhead.sql` cria `plans`, `subscriptions`, `payments` e `subscription_events`. A migração `drizzle/0008_nullable_plan_limits.sql` corrige a estrutura dos limites: `NULL` significa ilimitado; `999999` é apenas um valor legado que deve ser convertido para `NULL`. Elas não devem ser aplicadas automaticamente no deploy. Faça backup, valide em banco CI isolado, revise o SQL e aplique somente em janela controlada com `pnpm exec drizzle-kit push --strict`. Empresas existentes sem assinatura permanecem compatíveis até a configuração manual pelo `PLATFORM_ADMIN`; consulte `SUBSCRIPTIONS.md` para as regras de acesso, renovação e tolerância.
