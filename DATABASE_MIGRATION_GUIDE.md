# Guia de conexão do banco para outra conta ou IA

Este arquivo existe para evitar que a próxima conta precise descobrir a arquitetura do projeto por tentativa e erro.

## Banco atual

O projeto usa um banco MySQL/TiDB externo. **Os dados não ficam no GitHub e a senha não deve ser colocada neste arquivo.**

```dotenv
# Perfil do banco atual — metadados não secretos para facilitar a configuração
# Host: gateway05.us-east-1.prod.aws.tidbcloud.com
# Porta: 4000
# Banco/schema: VQ74gbx2JGcCSFKb6jYEZ9
# Usuário: root
# TLS: obrigatório
#
# Preencha a senha somente no secret manager da nova plataforma:
EXTERNAL_DATABASE_URL=mysql://root:<COLOQUE_A_SENHA_NO_SECRET_MANAGER>@gateway05.us-east-1.prod.aws.tidbcloud.com:4000/VQ74gbx2JGcCSFKb6jYEZ9?ssl={"rejectUnauthorized":true}
```

> A senha que foi compartilhada durante a configuração deve ser considerada exposta e **rotacionada no TiDB Cloud** antes de usar a nova conta. Depois da rotação, coloque a nova URL somente como secret `EXTERNAL_DATABASE_URL`.

## Configuração mínima na nova conta

1. Importe o repositório privado `IvanMHonemann/gestao-extintores`.
2. Crie os secrets, sem salvar os valores no código:
   - `EXTERNAL_DATABASE_URL`: URL completa do banco atual, com a senha nova.
   - `DATABASE_URL`: opcional; o runtime usa `EXTERNAL_DATABASE_URL` primeiro.
   - `JWT_SECRET`: um segredo longo; preserve o atual apenas se for necessário manter sessões.
   - `MANUS_INTEGRATIONS=false` quando a hospedagem não for Manus.
3. Instale e valide:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm run build
```

4. Na prévia, teste nesta ordem:
   - login do administrador geral;
   - seleção de empresa ativa;
   - criação de cliente;
   - criação de extintor;
   - criação de OS;
   - aba de OS após recarregar a página;
   - impressão do documento;
   - compartilhamento no celular usando Chrome Android ou Safari iOS.

## Regras para outra IA

- Não substituir `EXTERNAL_DATABASE_URL` por um banco novo.
- Não executar `pnpm db:push`, `drizzle-kit migrate` ou SQL destrutivo antes de fazer backup e revisar o schema.
- Não copiar dados reais, senha, `.env`, tokens ou backups para GitHub.
- O GitHub guarda o código; o banco guarda os dados. Nunca tentar versionar o banco dentro do repositório.
- O administrador geral usa a rota `platform.data.*`; não exigir `tenantKey` para as operações globais.
- Depois de criar uma OS global, invalidar/recarregar `platform.data.orders` da empresa selecionada; caso contrário a OS pode estar salva e parecer desaparecida da tela.
- O endereço publicado de uma conta não é atualizado pela prévia de outra conta. Sempre testar a URL da prévia atual antes de publicar.
- O compartilhamento de PDF no celular depende do `navigator.share` do navegador; não redirecionar para `wa.me` nem exigir download manual como caminho principal.

## Diagnóstico rápido

Se a OS mostrar sucesso mas não aparecer:

1. confirmar que a empresa selecionada está ativa;
2. confirmar que o cliente pertence à empresa selecionada;
3. recarregar a aba de OS;
4. verificar a chamada `platform.data.createOrder` no console/rede;
5. verificar a chamada `platform.data.orders` após o sucesso;
6. consultar o banco somente em modo leitura antes de alterar qualquer coisa.

Se a URL pública mostrar uma tela antiga, o problema é publicação/domínio, não o banco: comparar a URL pública com a URL da prévia e publicar o checkpoint correto na conta que controla o domínio.
