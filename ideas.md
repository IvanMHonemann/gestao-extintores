# Direção visual — Gestão de Extintores

## Fonte da direção

O projeto recebido já possui uma identidade visual funcional e não deve ser substituído por uma nova direção. A referência é a interface existente no código: painel administrativo interno, navegação escura, destaque vermelho associado à segurança contra incêndio e telas operacionais densas, com foco em leitura rápida e ações claras.

## Movimento de design

**Operações de segurança confiáveis**: uma linguagem de painel profissional, direta e sóbria, que prioriza hierarquia, legibilidade e estados de alerta. A interface deve parecer uma ferramenta de trabalho diário, não uma landing page promocional.

## Princípios centrais

- Clareza antes de decoração.
- Estados de vencimento e risco devem ser compreensíveis por texto, cor e ícone.
- Controles de criação, edição, impressão e restauração devem ter ações visíveis e reversíveis quando possível.
- A navegação precisa funcionar em desktop e mobile sem esconder as funções essenciais.
- A identidade visual deve permanecer consistente entre login, painel, ordens de serviço, backup e telas administrativas.

## Filosofia de cor

O fundo slate/azul-marinho sustenta a navegação e as áreas de alta confiança. O vermelho de segurança funciona como cor de marca e ação crítica. Superfícies claras e neutras organizam tabelas e formulários. Verde, âmbar e vermelho comunicam, respectivamente, estado normal, atenção e vencimento/risco; nunca devem ser o único meio de comunicação.

## Paradigma de layout

O aplicativo usa um shell de painel com sidebar redimensionável, cabeçalho contextual em telas menores e conteúdo em cartões/tabelas. O conteúdo deve ocupar uma largura confortável, com espaçamento suficiente para leitura, filtros no topo e ações próximas do objeto que modificam.

## Elementos de assinatura

O símbolo de extintor e o vermelho de segurança formam a assinatura do produto. O manifesto PWA, ícones `icon-192.svg` e `icon-512.svg` e o favicon existente devem ser preservados como identidade do projeto. Evitar imagens decorativas e dependências visuais externas em um sistema operacional interno.

## Filosofia de interação

Ações normais devem responder rapidamente e reconciliar com o servidor; operações críticas como exclusão, restauração, backup e cobrança devem mostrar confirmação e resultado explícitos. Mensagens de erro devem ser acionáveis. O isolamento por empresa e as permissões são parte da experiência, não apenas detalhes de implementação.

## Animação

Usar transições curtas e discretas apenas para navegação, menus, skeletons e feedback de estado. Não usar animação decorativa que atrase a leitura de alertas ou a execução de rotinas de manutenção.

## Tipografia

Manter a tipografia sans-serif atual, com títulos fortes, rótulos compactos e texto de suporte legível. Números, datas, códigos de OS e estados devem ter alinhamento e contraste adequados para conferência rápida.

## Essência e voz da marca

A marca deve transmitir **controle, prevenção e responsabilidade**. O texto da interface é curto, profissional e em português do Brasil; evita jargão técnico quando a ação é destinada ao operador e explica o que aconteceu quando uma operação falha.

## Wordmark e cor de marca

O nome exibido é **Gestão de Extintores**. A cor de marca é o vermelho de segurança usado nas ações primárias e no símbolo de extintor. O fundo escuro da navegação funciona como contraste institucional.

## Escopo visual

Este é um sistema de controle e operação, não uma superfície de marketing. Não serão gerados novos heróis, ilustrações ou imagens de estoque; os ícones e assets existentes são suficientes para o uso previsto. A alteração desta direção exigiria uma solicitação explícita do responsável pelo produto.
