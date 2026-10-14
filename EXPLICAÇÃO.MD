## Páginas HTML

- `index.html` — é a porta de entrada. Detecta a largura da janela e encaminha para a versão desktop ou mobile. Se o JavaScript estiver desativado, oferece links para escolher manualmente.
- `organograma-desktop.html` — define a estrutura da interface desktop: barra de ações, busca, legenda, área do diagrama e região de avisos para leitores de tela. Também carrega os scripts na ordem necessária.
- `organograma-mobile.html` — define a mesma interface para a versão mobile e carrega o perfil de medidas específico dessa tela. Os dados e a lógica são compartilhados com o desktop.

## Estilos CSS

- `organograma.css` — concentra os estilos compartilhados: cores, tipografia, busca, legenda, cards, conectores e estados de foco e animação.
- `desktop.css` — ajusta margens, tamanhos e espaçamentos para telas maiores.
- `mobile.css` — adapta a interface para telas estreitas, com controles maiores para toque e espaços mais compactos.

## JavaScript

- `dados-organograma.js` — contém a árvore de unidades. Cada nó representa um card, e a lista `filhos` determina a subordinação. É o principal arquivo para alterar os dados do organograma.
- `organograma-layout.js` — calcula as posições e dimensões dos cards e o percurso dos conectores. É um algoritmo independente do navegador e do DOM, o que permite testá-lo separadamente.
- `organograma-core.js` — coordena a aplicação: valida os dados, cria e posiciona os cards, desenha os conectores, anima as mudanças e implementa as interações, como teclado, expansão, legenda e acessibilidade.
- `organograma-busca.js` — cuida da busca por nome, sigla ou tipo. Normaliza acentos, ordena sugestões e trata teclado e atributos ARIA; quando uma opção é escolhida, pede ao núcleo que navegue até o card.
- `organograma-desktop.js` — informa ao núcleo os valores de layout do desktop, como largura e espaçamentos.
- `organograma-mobile.js` — define as medidas do mobile e ativa o comportamento de acordeão nas unidades subordinadas à raiz.
- `d3.min.js` — biblioteca D3 usada pelo projeto para trabalhar com a hierarquia e desenhar elementos. É um arquivo de terceiros minificado, então normalmente não deve ser editado.

## Testes

- `layout.test.js` — testa a geometria do algoritmo sem abrir o navegador. Usa os dados do projeto, perfis desktop e mobile e cenários sintéticos; verifica se todos os cards foram posicionados, se não há sobreposição ou estouro de largura e se os conectores não atravessam cards. A aleatoriedade usa uma semente fixa para que os cenários sejam reproduzíveis.
- `browser_test.py` — testa a aplicação num navegador real. Confere layout e interações, como busca, teclado, expansão, legenda, acordeão, redirecionamento e movimento reduzido.
- `cores_test.py` — verifica as cores definidas no CSS, incluindo contraste, distinção entre tipos sob simulações de daltonismo e hierarquia por luminosidade.

## Documentação

- `LEIAME.md` — guia principal: apresenta a estrutura, a navegação, como o layout funciona, como manter o projeto e como executar os testes.
- `INTEGRACAO.md` — registra os recursos integrados, os arquivos envolvidos e as decisões tomadas durante essa integração.

## Como as partes se conectam

O fluxo principal é:

**`index.html` → página desktop/mobile → dados → layout → núcleo**

A página carrega os dados e os módulos. O núcleo valida os dados, mede os cards, solicita as posições ao algoritmo de layout e desenha o resultado. A busca e os controles da interface acionam funções do núcleo; o CSS define a aparência. Os testes verificam partes diferentes desse fluxo: o algoritmo isolado, o comportamento no navegador e a acessibilidade das cores.