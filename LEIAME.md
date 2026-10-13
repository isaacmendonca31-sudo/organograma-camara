# Organograma institucional

HTML + CSS + JavaScript + D3.js (v7.9.0, licença ISC, incluído em `js/vendor/`). Sem build, sem npm, sem CDN: basta publicar a pasta ou abrir o `index.html` no navegador (funciona offline).

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Escolhe a versão pela largura da janela (`matchMedia`, até 640 px = mobile). Sem JavaScript, mostra links manuais. |
| `organograma-desktop.html` / `organograma-mobile.html` | Páginas; cada uma tem o botão de trocar de versão (link simples, sem iframe). |
| `js/dados-organograma.js` | **Única fonte de dados** (a mesma nos dois layouts). É o único arquivo a editar para mudar a estrutura. |
| `js/organograma-layout.js` | Algoritmo de posicionamento puro (sem DOM): larguras, quebra em linhas, alturas, conectores. |
| `js/organograma-core.js` | Validação dos dados, `d3.hierarchy`, cards, SVG, animação, teclado/ARIA, legenda, botões. |
| `js/organograma-busca.js` | Busca com normalização de acentos (combobox ARIA). Só conversa com o núcleo por `irPara`. |
| `js/organograma-desktop.js` / `-mobile.js` | Perfis: largura máxima, tamanho dos cards, espaçamentos e (mobile) a regra de acordeão. |
| `css/organograma.css` | Estilos compartilhados: busca, legenda, cards, tipos, conectores. `desktop.css` e `mobile.css` ajustam só a página. |
| `tests/` | `layout.test.js` (algoritmo), `browser_test.py` (navegador) e `cores_test.py` (acessibilidade das cores). |

### Como percorrer o código

1. Comece em `index.html`: ele escolhe desktop ou mobile pela largura da janela.
2. Abra a página selecionada (`organograma-desktop.html` ou `organograma-mobile.html`):
   o HTML define os elementos da interface e carrega os scripts na ordem necessária.
3. Para entender os setores e suas relações, leia `js/dados-organograma.js`.
   Cada chamada `node(...)` cria um card; a lista `filhos` define as ligações hierárquicas.
4. Para entender o posicionamento, leia `js/organograma-layout.js` e depois
   `js/organograma-core.js`: o primeiro calcula coordenadas sem DOM; o segundo
   mede e desenha os cards, anima conectores e trata interações.
5. Para mudar a apresentação, compare `css/organograma.css` com o perfil da tela
   (`css/desktop.css` ou `css/mobile.css`). Para busca textual, siga
   `js/organograma-busca.js`, que delega a navegação ao núcleo.

`js/vendor/d3.min.js` é uma dependência de terceiros minificada; não é código
de negócio do projeto e normalmente não deve ser editada.

## Como o layout funciona

1. Cada card visível é medido no DOM (tamanho real, com o texto quebrado).
2. Os filhos de um nó ficam lado a lado enquanto couberem na largura disponível; se não couberem, quebram em linhas **balanceadas** (ex.: 23 comissões → 6+6+6+5, não 7+7+7+2). Cards da mesma linha ficam com a mesma altura.
3. O pai é centralizado sobre a primeira linha de filhos. Linhas seguintes se ligam por um "tronco" no corredor esquerdo, por onde nenhum card passa.
4. Desktop e mobile usam o mesmo algoritmo; muda só o orçamento de largura (desktop: largura da janela; mobile: ≥ 2 cards por linha). Por isso o desktop cresce para os lados e o mobile para baixo, sem `scale()` nem `overflow-x`.
5. Expandir/recolher recalcula tudo; cards e conectores são interpolados juntos a cada quadro, e o card clicado fica parado na tela.

## Recursos de navegação

### Busca
Campo "Buscar unidade" acima da legenda. Procura por **nome, sigla e tipo**, ignorando acentos e maiúsculas (`comissoes` acha "Comissões Legislativas"). Vários termos se combinam (todos precisam aparecer): `diretoria geral`. Mostra até 12 resultados, os mais relevantes primeiro (sigla exata > começo do nome > contém).

- **Escolher** (clique, toque ou Enter): abre os ancestrais, foca o card, rola até ele e o faz pulsar. Se o resultado for um atalho (`targetId`), vai ao destino.
- **Teclado:** `↓`/`↑` percorrem as sugestões (e dão a volta), `Enter` escolhe (sem opção ativa, escolhe a primeira), `Esc` fecha a lista (um segundo `Esc` limpa o campo), `Tab` sai do campo.
- Clicar fora fecha a lista. Leitores de tela ouvem "N resultados" e "Navegando para X" (região `aria-live`).
- No mobile o campo tem no mínimo 44 px de altura.

### Botões da barra
- **Expandir próximo nível:** abre um nível por clique (o mais raso que ainda tenha cards fechados entre os visíveis). Quando não há mais o que abrir, avisa "Todos os níveis já estão expandidos".
- **Expandir tudo / Recolher tudo.**
- **Ver versão mobile/desktop.**

### Legenda clicável
Cada tipo da legenda é um botão: clicar leva ao **primeiro card daquele tipo** (na ordem de leitura do organograma). A legenda é gerada a partir dos dados.

### Acordeão (só mobile)
No mobile, abrir um dos filhos diretos da raiz fecha os outros, para a página não ficar gigante. Busca, legenda, atalhos, "Expandir tudo" e "Expandir próximo nível" ignoram essa regra. No desktop não existe.

## Validação dos dados
Antes de desenhar, o núcleo confere os dados: `id` único e não vazio, `nome` presente, `tipo` cadastrado em `ROTULOS_TIPO` e `targetId` apontando para um id existente. Se algo estiver errado, a página mostra um aviso (`role="alert"`) com a causa e o `console.error` registra o mesmo; nada é desenhado.

## Manutenção

- **Novo setor/comissão/funcionário:** adicione `node(...)` (ou os atalhos `diretoria(...)`, `gerencia(...)` etc.) no array `filhos` do pai, em `dados-organograma.js`. Nada no algoritmo muda.
- **Novo tipo visual:** inclua em `ROTULOS_TIPO` (`organograma-core.js`) e crie `.card-<tipo>` em `organograma.css`. A legenda e a validação se atualizam sozinhas.
- **Espaçamento/tamanho:** `organograma-desktop.js` e `organograma-mobile.js` (só números).
- **Atalho entre cards:** `targetId` em um card faz o clique levar ao card alvo.
- **Padrão dos comentários:** cada função explica *o que faz* e *por que existe*; as constantes explicam de onde vem o valor. Mantenha isso ao alterar o código.

## Acessibilidade
Padrão ARIA *tree*: `↑`/`↓` percorrem os cards, `→` expande (ou entra no primeiro filho), `←` recolhe (ou sobe ao pai), `Enter`/`Espaço` alternam, `Home`/`End` vão ao primeiro/último. Cada card expõe `aria-expanded`, `aria-level` e rótulo com nome, sigla, tipo e quantidade de subunidades. A busca segue o padrão *combobox* com `aria-activedescendant`. O tipo aparece escrito em cada card (a cor não é a única pista, veja "Cores e acessibilidade"), há foco visível em todos os controles e as animações respeitam `prefers-reduced-motion`.

## Cores e acessibilidade

A paleta segue quatro regras, todas verificadas por `tests/cores_test.py`:

1. **Hierarquia por luminosidade.** Quanto mais importante o nível, mais escuro e cheio é o card. Luminosidade é a única informação que todos os tipos de visão (inclusive daltonismo e escala de cinza) percebem igual.
2. **Contraste WCAG 2.2.** Texto ≥ 4,5:1 (níveis 1 e 2 ≥ 7:1); bordas, conectores e anel de foco ≥ 3:1.
3. **Daltonismo.** Cada par de tipos do mesmo nível fica a pelo menos 10 de distância (CIEDE2000) sob visão normal, protanopia, deuteranopia e tritanopia. Evita-se verde × vermelho com a mesma luminosidade.
4. **Formato único, só a cor muda.** Todos os cards têm o mesmo tamanho, cantos, borda e fonte. Como a cor fica sozinha na diferenciação visual, o nome do tipo vem escrito em todo card (WCAG 1.4.1) e a paleta é separada numericamente para as 4 visões.

| Nível | Tipo | Cor |
|---|---|---|
| 1 | Instituição | azul-marinho `#0E1A4F` |
| 2 | Órgão | índigo `#3B3AA8` |
| 3 | Gabinete | azul-petróleo `#006E76` |
| 3 | Diretoria | terracota `#C24E12` |
| 4 | Coordenadoria | azul `#2A53DC` |
| 5 | Gerência | verde `#007E52` |
| 6 | Assessoria | rosa `#D84864` |
| 6 | Comissão | roxo `#7D247C` |
| 6 | Ouvidoria | azul-claro `#3886EA` |
| 6 | Chefia | dourado `#A07800` |
| 6 | Unidade | cinza `#6B7388` |
| 6 | Cargo | ardósia `#2B3042` |

Os níveis 4 a 6 têm preenchimento claro (tom da própria cor), borda forte e texto escuro. Conectores comuns são cinza-azulados; os da cadeia de comando em foco são terracota e mais grossos. O anel de foco do teclado é violeta, cor que nenhum card usa.

**Trocar uma cor:** edite o valor na regra `.card-<tipo>` (seção 7 de `css/organograma.css`) e rode `python3 tests/cores_test.py`; ele diz exatamente qual regra deixou de valer. Para ver como fica para quem tem daltonismo, `python3 tests/cores_test.py --tabela` lista as distâncias entre os tipos.

O CSS também trata `forced-colors` (modo de alto contraste do Windows): contornos e conectores continuam visíveis e o formato dos cards é o mesmo.

## Fonte e nitidez

- **Fonte:** todo o conteúdo usa **Creato Display** (sem serifa), em 3 pesos (400, 500, 700). Os arquivos da fonte não vêm no projeto; instale-a no computador ou siga `fonts/LEIAME.txt`. Sem ela, entra a fonte sem serifa do sistema. A pilha está em `--fonte-texto` (`css/organograma.css`).
- **Nitidez:** em repouso, cada card é posicionado na grade de pixels físicos da tela (`alinhar` em `desenhar`), tem largura e altura inteiras e só ganha camada de GPU (`will-change`) enquanto anima. Isso evita o texto "embaçado", principalmente em telas com escala 125%/150%.

## Testes
- `node tests/layout.test.js`: 478 cenários do algoritmo, sem navegador (sobreposição, conectores atravessando cards, largura).
- `python3 tests/browser_test.py`: Chromium headless; mede o DOM real em várias larguras e exercita busca, próximo nível, legenda, acordeão, validação, `index.html`, teclado e movimento reduzido; confere que as cores renderizadas são as do CSS e têm contraste ≥ 4,5:1. Exige zero `console.error`.
- `python3 tests/cores_test.py`: contraste WCAG, distância entre tipos sob 3 tipos de daltonismo e ordem da hierarquia, lendo as cores direto do CSS. Precisa de `pip install numpy scikit-image` (só para testes; o site não usa nada disso).

Os testes têm focos diferentes: `layout.test.js` valida a matemática isoladamente;
`browser_test.py` verifica o resultado no navegador e o comportamento interativo;
`cores_test.py` checa os tokens definidos no CSS. Ao explicar uma mudança, indique
qual desses níveis cobre o comportamento alterado.
