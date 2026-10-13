/*
 * Algoritmo de posicionamento do organograma (puro: não usa DOM nem D3).
 *
 * Por que "puro"? Porque assim ele roda em Node (tests/layout.test.js) e pode ser
 * verificado matematicamente - sem navegador - contra sobreposição de cards,
 * conectores que atravessam cards e estouro de largura. Qualquer mudança aqui
 * deve manter esses testes passando.
 *
 * Entrada: a árvore VISÍVEL { id, w, h, children: [...] } com o tamanho real dos cards.
 * Opções:  maxWidth  largura máxima disponível (orçamento horizontal)
 *          gapX      espaço entre cards irmãos
 *          groupGap  espaço extra quando um dos irmãos tem filhos (separa grupos)
 *          gapY      espaço vertical entre níveis (e entre linhas de irmãos)
 *          gutter    corredor lateral reservado ao "tronco" quando os filhos quebram em linhas
 *
 * Ideia central: cada nó ocupa uma "caixa" (card + subárvore). Os filhos são
 * colocados lado a lado enquanto couberem no orçamento; ao exceder, quebram em
 * várias linhas balanceadas. O resultado cresce para os lados até o limite da
 * largura e só então para baixo - sem scale() e sem rolagem horizontal.
 * Desktop e mobile usam o mesmo algoritmo, mudando apenas maxWidth e tamanhos.
 */
(function (root, factory) {
  // Padrão UMD mínimo: no navegador publica `window.OrganogramaLayout`;
  // no Node (testes) exporta via module.exports.
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrganogramaLayout = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Calcula a posição de todos os nós da árvore visível.
   *
   * @param {{id: string, w: number, h: number, children: object[]}} tree Raiz visível.
   * @param {{maxWidth: number, gapX: number, gapY: number, groupGap: number, gutter: number}} opt Opções.
   * @returns {{width: number, height: number, nodes: Map<string, object>, edges: object[], overflow: boolean}}
   *          Tamanho total, posição (x, y, w, h) de cada nó, conectores e se excedeu a largura.
   */
  function compute(tree, opt) {
    const { maxWidth, gapX, gapY, groupGap, gutter } = opt;

    // Memoização do plano por (nó, orçamento): cada subárvore é planejada uma única vez
    // por orçamento, o que mantém o custo linear mesmo com centenas de cards.
    const memo = new Map();

    const temFilhos = (n) => n.children.length > 0;

    // Entre dois irmãos, o espaço normal é gapX; se algum deles tem filhos, soma-se
    // groupGap para que os grupos (com seus conectores) não pareçam colados.
    const gapEntre = (a, b) => gapX + (temFilhos(a) || temFilhos(b) ? groupGap : 0);

    // Largura ocupada pelos irmãos de índice [de, ate) numa mesma linha.
    function larguraLinha(kids, de, ate) {
      let w = 0;
      for (let i = de; i < ate; i++) {
        if (i > de) w += gapEntre(kids[i - 1].node, kids[i].node);
        w += kids[i].w;
      }
      return w;
    }

    // Quebra gulosa em linhas de no máximo "limite" de largura: enche cada linha
    // até o próximo irmão não caber. Devolve pares [inicio, fim) de índices.
    function quebrar(kids, limite) {
      const linhas = [];
      let inicio = 0;
      let w = 0;
      for (let i = 0; i < kids.length; i++) {
        const soma = i === inicio ? kids[i].w : gapEntre(kids[i - 1].node, kids[i].node) + kids[i].w;
        if (i > inicio && w + soma > limite) {
          linhas.push([inicio, i]);
          inicio = i;
          w = kids[i].w;
        } else {
          w += soma;
        }
      }
      linhas.push([inicio, kids.length]);
      return linhas;
    }

    // Mantém o número mínimo de linhas, mas procura a menor largura que o permita,
    // evitando 7+7+7+2 quando 6+6+6+5 fica mais equilibrado. A busca é binária
    // sobre a largura, pois a quantidade de linhas só diminui quando o limite cresce.
    function linhasBalanceadas(kids, limite) {
      const maior = Math.max(...kids.map((k) => k.w));
      const teto = Math.max(maior, limite);
      const alvo = quebrar(kids, teto).length;
      let lo = maior;
      let hi = teto;
      while (lo < hi) {
        const meio = (lo + hi) >> 1;
        if (quebrar(kids, meio).length <= alvo) hi = meio;
        else lo = meio + 1;
      }
      return quebrar(kids, lo);
    }

    // Fase 1 - plano: larguras e divisão em linhas (não depende de alturas).
    // Devolve { node, w (largura da caixa), rows, kids, gutter, contentW }.
    function plano(n, orcamento) {
      const chave = n.id + '|' + orcamento;
      if (memo.has(chave)) return memo.get(chave);

      let p;
      if (!temFilhos(n)) {
        // Folha: a caixa é o próprio card.
        p = { node: n, w: n.w, rows: [], kids: [], gutter: 0, contentW: 0 };
      } else {
        let kids = n.children.map((c) => plano(c, orcamento));
        const unica = larguraLinha(kids, 0, kids.length);
        if (unica <= orcamento) {
          // Cabem todos numa única linha: layout "horizontal" clássico.
          p = { node: n, w: Math.max(n.w, unica), rows: [[0, kids.length]], kids, gutter: 0, contentW: unica };
        } else {
          // Não cabem: reserva o corredor do tronco e recalcula os filhos no espaço restante.
          const interno = orcamento - gutter;
          kids = n.children.map((c) => plano(c, interno));
          const rows = linhasBalanceadas(kids, interno);
          const contentW = Math.max(...rows.map((r) => larguraLinha(kids, r[0], r[1])));
          const g = rows.length > 1 ? gutter : 0;
          p = { node: n, w: Math.max(n.w, g + contentW), rows, kids, gutter: g, contentW };
        }
      }
      memo.set(chave, p);
      return p;
    }

    const raiz = plano(tree, maxWidth);

    // Fase 2a - cards da mesma linha ficam com a mesma altura (a do maior),
    // para que a linha pareça uma fileira alinhada.
    const alturaCard = new Map();
    (function atribuir(p, h) {
      alturaCard.set(p.node.id, h);
      p.rows.forEach(([a, b]) => {
        let max = 0;
        for (let i = a; i < b; i++) max = Math.max(max, p.kids[i].node.h);
        for (let i = a; i < b; i++) atribuir(p.kids[i], max);
      });
    })(raiz, raiz.node.h);

    // Fase 2b - altura da caixa de cada subárvore (card + níveis abaixo), com cache.
    const alturas = new Map();
    function alturaCaixa(p) {
      if (alturas.has(p)) return alturas.get(p);
      let h = alturaCard.get(p.node.id);
      if (p.rows.length) {
        let corpo = 0;
        p.rows.forEach(([a, b], r) => {
          let rh = 0;
          for (let i = a; i < b; i++) rh = Math.max(rh, alturaCaixa(p.kids[i]));
          corpo += rh + (r > 0 ? gapY : 0);
        });
        h += gapY + corpo;
      }
      alturas.set(p, h);
      return h;
    }

    // Fase 2c - posições absolutas e conectores.
    const nodes = new Map();
    const edges = [];

    // Posiciona a caixa de `p` em (caixaX, caixaY) e devolve o centro horizontal do card.
    function posicionar(p, caixaX, caixaY, pai, profundidade) {
      const n = p.node;
      const h = alturaCard.get(n.id);
      let cx;

      if (!p.rows.length) {
        cx = caixaX + p.w / 2;
      } else {
        // Começo do conteúdo dos filhos: após o corredor e centralizado na caixa.
        const x0 = caixaX + p.gutter + (p.w - p.gutter - p.contentW) / 2;
        const topoPrimeiraLinha = caixaY + h + gapY;
        const linhas = [];
        let y = topoPrimeiraLinha;

        p.rows.forEach(([a, b]) => {
          let x = x0;
          let altura = 0;
          const filhos = [];
          for (let i = a; i < b; i++) {
            if (i > a) x += gapEntre(p.kids[i - 1].node, p.kids[i].node);
            const kid = p.kids[i];
            filhos.push({ id: kid.node.id, cx: posicionar(kid, x, y, n.id, profundidade + 1) });
            x += kid.w;
            altura = Math.max(altura, alturaCaixa(kid));
          }
          linhas.push({ topo: y, filhos });
          y += altura + gapY;
        });

        // O pai fica centrado sobre a primeira linha de filhos: com um filho só,
        // o conector desce reto, sem "degrau".
        const primeira = linhas[0].filhos;
        cx = (primeira[0].cx + primeira[primeira.length - 1].cx) / 2;
        // Garante que o card do pai não saia da sua própria caixa.
        cx = Math.min(Math.max(cx, caixaX + n.w / 2), caixaX + p.w - n.w / 2);

        // Conectores: barra horizontal no meio do espaço acima de cada linha.
        // Linhas 2+ sobem pelo "tronco" no corredor esquerdo (fora de qualquer card).
        const bus0 = caixaY + h + gapY / 2;
        const tronco = linhas.length > 1 ? x0 - p.gutter / 2 : null;
        linhas.forEach((linha, r) => {
          linha.filhos.forEach((f) => {
            edges.push({
              id: f.id,
              from: n.id,
              to: f.id,
              bus0,
              busR: linha.topo - gapY / 2,
              trunkX: r > 0 ? tronco : null
            });
          });
        });
      }

      nodes.set(n.id, { id: n.id, x: cx - n.w / 2, y: caixaY, w: n.w, h, parentId: pai, depth: profundidade });
      return cx;
    }

    posicionar(raiz, 0, 0, null, 0);

    const largura = raiz.w;
    return { width: largura, height: alturaCaixa(raiz), nodes, edges, overflow: largura > maxWidth + 0.5 };
  }

  // --- Geometria dos conectores (compartilhada por render e testes) ---

  // Tolerância (px) para considerar dois números iguais ao comparar coordenadas.
  const IGUAIS = 0.01;

  // Pontos (em ângulos retos) do conector pai -> filho. Todos os valores são absolutos.
  // px/pb: saída do pai (centro e base); cx/ct: chegada no filho (centro e topo);
  // bus0: altura da barra logo abaixo do pai; busR: altura da barra da linha do filho;
  // tx: posição X do tronco (null quando o filho está na primeira linha).
  function pontosAresta(px, pb, cx, ct, bus0, busR, tx) {
    const t = tx == null ? px : tx;
    const pts = [[px, pb], [px, bus0], [t, bus0], [t, busR], [cx, busR], [cx, ct]];
    // Remove pontos repetidos e pontos no meio de uma reta, deixando só os vértices reais
    // (necessário para arredondar os cantos corretamente).
    const out = [];
    pts.forEach((p) => {
      const u = out[out.length - 1];
      if (!u || Math.abs(u[0] - p[0]) > IGUAIS || Math.abs(u[1] - p[1]) > IGUAIS) out.push(p);
    });
    for (let i = 1; i < out.length - 1;) {
      const a = out[i - 1];
      const b = out[i];
      const c = out[i + 1];
      const vertical = Math.abs(a[0] - b[0]) < IGUAIS && Math.abs(b[0] - c[0]) < IGUAIS;
      const horizontal = Math.abs(a[1] - b[1]) < IGUAIS && Math.abs(b[1] - c[1]) < IGUAIS;
      if (vertical || horizontal) out.splice(i, 1);
      else i++;
    }
    return out;
  }

  // Converte os pontos em um caminho SVG com cantos arredondados (curvas de Bézier
  // quadráticas em cada vértice, limitadas à metade do segmento para nunca "passar" do ponto).
  function caminhoArredondado(pts, raio) {
    if (pts.length < 2) return '';
    const f = (v) => Math.round(v * 100) / 100; // 2 casas decimais: SVG menor, sem perda visível
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const c = pts[i + 1];
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      const r = Math.min(raio, l1 / 2, l2 / 2);
      const p1 = [b[0] + ((a[0] - b[0]) / l1) * r, b[1] + ((a[1] - b[1]) / l1) * r];
      const p2 = [b[0] + ((c[0] - b[0]) / l2) * r, b[1] + ((c[1] - b[1]) / l2) * r];
      d += `L${f(p1[0])},${f(p1[1])}Q${f(b[0])},${f(b[1])} ${f(p2[0])},${f(p2[1])}`;
    }
    const u = pts[pts.length - 1];
    return d + `L${f(u[0])},${f(u[1])}`;
  }

  return { compute, pontosAresta, caminhoArredondado };
}));
