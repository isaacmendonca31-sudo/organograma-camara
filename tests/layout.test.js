/*
 * Testes do algoritmo de posicionamento em Node, sem abrir navegador.
 * Execução: node tests/layout.test.js
 *
 * Este arquivo cria árvores de nós visíveis e perfis parecidos com os usados
 * na aplicação; depois verifica a geometria retornada pelo layout: todos os
 * cards posicionados, sem sobreposição, dentro da largura e sem conectores
 * passando por dentro dos cards. Ao final, process.exit(1) sinaliza falhas ao CI.
 */
const path = require('path');
global.window = {};
require(path.join(__dirname, '../js/dados-organograma.js'));
const L = require('../js/organograma-layout.js');
const dados = window.organogramaDados;

// Mesmos valores dos perfis da aplicação; assim o teste cobre larguras reais de uso.
const desktop = (W) => ({ maxWidth: Math.min(W, 1760), cardWidth: 200, gapX: 24, groupGap: 24, gapY: 64, gutter: 20 });
const mobile = (W) => {
  const gutter = 16, gapX = 12;
  const cols = Math.max(2, Math.floor((W - gutter + gapX) / (132 + gapX)));
  const cardWidth = Math.max(120, Math.min(168, Math.floor((W - gutter - gapX * (cols - 1)) / cols)));
  return { maxWidth: W, cardWidth, gapX, groupGap: 12, gapY: 44, gutter };
};

// O teste não mede DOM: aproxima a altura pelo nome e pela largura para cobrir
// casos com textos de comprimentos variados, sem depender de fontes instaladas.
const altura = (nome, w) => 44 + Math.ceil((nome.length * 7) / (w - 24)) * 17;
const escala = { instituicao: 1.3, orgao: 1.15 };

// Converte os dados oficiais no formato mínimo consumido por Layout.compute().
// `expandidos` controla quais filhos entram na árvore visível do cenário.
function arvore(no, expandidos, p) {
  const w = Math.min(p.maxWidth, Math.round(p.cardWidth * (escala[no.tipo] || 1)));
  const aberto = expandidos === 'todos' || expandidos.has(no.id);
  return {
    id: no.id, w, h: altura(no.nome, w),
    children: aberto ? no.filhos.map((f) => arvore(f, expandidos, p)) : []
  };
}

function conta(t) { return 1 + t.children.reduce((s, c) => s + conta(c), 0); }

function verificar(rotulo, tree, perfil) {
  const r = L.compute(tree, perfil);
  const erros = [];
  const cards = [...r.nodes.values()];

  if (cards.length !== conta(tree)) erros.push('nem todos os nós foram posicionados');
  if (r.overflow) erros.push(`largura ${r.width} excede o orçamento ${perfil.maxWidth}`);

  // 1) nenhum card sobrepõe outro (com folga mínima de 8px)
  const FOLGA = 8;
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i], b = cards[j];
      if (a.x < b.x + b.w + FOLGA && b.x < a.x + a.w + FOLGA && a.y < b.y + b.h + FOLGA && b.y < a.y + a.h + FOLGA) {
        erros.push(`sobreposição ${a.id} x ${b.id}`);
        if (erros.length > 5) return { r, erros };
      }
    }
  }
  // 2) tudo dentro da caixa
  cards.forEach((c) => {
    if (c.x < -0.5 || c.y < -0.5 || c.x + c.w > r.width + 0.5 || c.y + c.h > r.height + 0.5) erros.push(`${c.id} fora da caixa`);
  });
  // 3) conectores: nenhum segmento entra no interior de um card
  r.edges.forEach((e) => {
    const p = r.nodes.get(e.from), c = r.nodes.get(e.to);
    const pts = L.pontosAresta(p.x + p.w / 2, p.y + p.h, c.x + c.w / 2, c.y, e.bus0, e.busR, e.trunkX);
    for (let k = 0; k < pts.length - 1; k++) {
      const [x1, y1] = pts[k], [x2, y2] = pts[k + 1];
      const minx = Math.min(x1, x2), maxx = Math.max(x1, x2), miny = Math.min(y1, y2), maxy = Math.max(y1, y2);
      cards.forEach((q) => {
        const dentro = maxx > q.x + 0.5 && minx < q.x + q.w - 0.5 && maxy > q.y + 0.5 && miny < q.y + q.h - 0.5;
        if (dentro) erros.push(`conector ${e.from}->${e.to} atravessa ${q.id}`);
      });
    }
    // conector sempre desce
    for (let k = 0; k < pts.length - 1; k++) if (pts[k + 1][1] < pts[k][1] - 0.01) erros.push(`conector ${e.to} sobe`);
  });
  return { r, erros: [...new Set(erros)].slice(0, 6) };
}

// Amostras repetíveis: uma semente fixa facilita reproduzir qualquer falha.
let semente = 7;
const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
const todosIds = [];
(function c(n) { todosIds.push(n); n.filhos.forEach(c); })(dados);

let falhas = 0, total = 0;
// Executa um cenário e agrega falhas sem interromper os demais testes.
function rodar(rotulo, tree, perfil) {
  total++;
  const { r, erros } = verificar(rotulo, tree, perfil);
  if (erros.length) { falhas++; console.log('FALHA', rotulo, erros); }
  return r;
}

const larguras = [
  ['desktop', desktop, [1920, 1440, 1280, 1024, 800]],
  ['mobile', mobile, [768, 600, 430, 390, 360, 320]]
];
larguras.forEach(([nome, perfilFn, ws]) => {
  ws.forEach((W) => {
    const p = perfilFn(W);
    rodar(`${nome} ${W} tudo expandido`, arvore(dados, 'todos', p), p);
    rodar(`${nome} ${W} só raiz`, arvore(dados, new Set([dados.id]), p), p);
    for (let i = 0; i < 40; i++) {
      const set = new Set([dados.id]);
      todosIds.forEach((n) => { if (n.filhos.length && rnd() < 0.5) set.add(n.id); });
      rodar(`${nome} ${W} aleatório ${i}`, arvore(dados, set, p), p);
    }
  });
});

// Casos sintéticos isolam quantidades de filhos específicas sem alterar os dados oficiais.
const sintetico = (filhos, fundo = 0) => {
  let k = 0;
  const mk = (nivel, n) => ({ id: `s${k++}`, nome: 'Setor ' + k, tipo: 'x', filhos: nivel > 0 ? Array.from({ length: n }, () => mk(nivel - 1, n)) : [] });
  const raiz = mk(0, 0);
  raiz.filhos = Array.from({ length: filhos }, () => ({ id: `s${k++}`, nome: 'Filho ' + k, tipo: 'x', filhos: [] }));
  return raiz;
};
[[5, 'CEO com 5 setores'], [3, 'setor com 3 filhos'], [12, 'setor com 12 filhos'], [40, 'setor com 40 filhos']].forEach(([n, nome]) => {
  [desktop(1440), desktop(1024), mobile(390), mobile(320)].forEach((p) => rodar(`${nome} @${p.maxWidth}`, arvore(sintetico(n), 'todos', p), p));
});

// Exemplos resumidos no relatório ajudam a comparar a distribuição em cada perfil.
const p1 = desktop(1440);
const r1 = L.compute(arvore(dados, new Set([dados.id, dados.filhos[0].id]), p1), p1);
const linhas = new Set([...r1.nodes.values()].filter((n) => n.depth === 2).map((n) => n.y)).size;
console.log(`Comissões (23 filhos) no desktop 1440: ${linhas} linhas, largura ${r1.width}`);
const p2 = mobile(360);
const r2 = L.compute(arvore(dados, 'todos', p2), p2);
console.log(`Mobile 360, tudo expandido: ${r2.nodes.size} cards, ${Math.round(r2.width)}x${Math.round(r2.height)}px`);
const p3 = desktop(1440);
const r3 = L.compute(arvore(dados, 'todos', p3), p3);
console.log(`Desktop 1440, tudo expandido: ${r3.nodes.size} cards, ${Math.round(r3.width)}x${Math.round(r3.height)}px`);

console.log(falhas ? `\n${falhas}/${total} cenários com falha` : `\nOK: ${total} cenários, sem sobreposição, sem conectores atravessando cards, dentro da largura`);
process.exit(falhas ? 1 : 0);
