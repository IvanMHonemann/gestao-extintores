# Segurança do Extinfy

## Segredos
Nunca versionar valores. Configurar `EXTERNAL_DATABASE_URL`, `JWT_SECRET` (mínimo 32 bytes aleatórios), `SCHEDULE_SECRET`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_ENVIRONMENT`, `APP_PUBLIC_URL` e credenciais de e-mail no secret manager, separando Production/Preview/Development. Ao suspeitar de vazamento, revogar e substituir o valor, reiniciar/republicar e revisar logs.

## Produção
O banco TiDB deve usar TLS, usuário de menor privilégio, backups/PITR do provedor e acesso restrito. A aplicação usa HTTPS, cookie `__Host-`, CSP, CSRF por origem e limite de corpo. Cartões nunca entram no servidor: pagamentos ocorrem no checkout hospedado da Asaas.

## Incidente
1. Registrar horário, URL, tenant afetado e evidências sem copiar tokens/senhas.
2. Revogar sessões da conta/usuários afetados e rotacionar segredo comprometido.
3. Suspender webhook ou cobranças somente se houver indício de fraude.
4. Preservar logs de auditoria e eventos de pagamento; não editar registros append-only.
5. Corrigir, testar e publicar hotfix em branch revisada.
6. Notificar o responsável pelo produto e, quando aplicável, titulares conforme LGPD.

## Backup e restauração
Backups devem ser cifrados antes do armazenamento, com chave fora do repositório, retenção de 30 diários e 12 mensais, acesso somente a administradores autorizados e teste de restauração em ambiente separado. Nunca restaurar sobre produção sem snapshot e plano de rollback.

## Verificações
Rodar `pnpm run check`, `pnpm test`, `pnpm audit --prod` e a varredura de segredos do CI antes de merge. Fazer revisão independente e pentest externo antes de escalar vendas.
