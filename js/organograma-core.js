/**
 * NÚCLEO DO ORGANOGRAMA
 *
 * Faz tudo que acontece na tela: valida os dados, desenha os cards, anima o
 * abrir/fechar, liga o teclado e os botões da barra.
 *
 * ONDE ESTÁ CADA COISA (procure pelos títulos "=====" neste arquivo):
 *   1. CONSTANTES ......... duração da animação, textos lidos por leitor de tela
 *   2. VALIDAÇÃO .......... confere os dados antes de desenhar
 *   3. MONTAGEM ........... estado, cards (HTML), medição, layout, animação
 *   4. AÇÕES .............. clique, teclado, botões, destaque do caminho
 *   5. REDIMENSIONAR ...... refaz o layout quando a largura muda
 *
 * O QUE EDITAR EM CADA CASO (você quase nunca precisa mexer aqui):
 *   - estrutura, nomes, siglas, cores de dimensão ... js/dados-organograma.js
 *   - cores e aparência ............................. css/organograma.css
 *   - tamanho/espaço dos cards ...................... js/organograma-perfil.js
 *   - posição dos cards (matemática) ................ js/organograma-layout.js
 *
 * Cards são HTML (texto quebra linha e é lido por leitor de tela); os
 * conectores são SVG. Os dois são posicionados juntos, a cada quadro da animação.
 */
(function (global) {
  'use strict';

  const d3 = global.d3;
  const Layout = global.OrganogramaLayout;

  // ===========================================================================
  // 1. CONSTANTES
  // ===========================================================================

  /**
   * Perfil = números do layout para a tela atual (vem de organograma-perfil.js):
   *   maxWidth, cardWidth, gapX, groupGap, gapY, gutter, radius, acordeaoRaizes.
   */

  /** Dimensões aceitas e o texto lido por leitor de tela (a cor sozinha não basta). */
  const ROTULOS_DIMENSAO = Object.freeze({
    legislativa: 'unidade legislativa',
    administrativa: 'unidade administrativa'
  });

  /** Sem `dimensao` nos dados, o card é administrativo. */
  const dimensaoDe = (dados) => dados.dimensao || 'administrativa';

  /** EDITAR AQUI: duração da animação de abrir/fechar (milissegundos). */
  const DURACAO_MS = 380;

  /** Nome usado para lembrar quais cards estavam abertos ao recarregar a página. */
  const CHAVE_ESTADO = 'organograma:expandidos';

  /** Limites usados por `ajustarPerfil` em telas muito estreitas. */
  const LARGURA_MINIMA_CARD = 96;
  const GUTTER_MINIMO = 8;
  const RESERVA_CARDS_POR_LINHA = 112;

  /** Valor entre `a` e `b` na posição `t` (0 a 1). */
  const lerp = (a, b, t) => a + (b - a) * t;

  // ===========================================================================
  // 2. VALIDAÇÃO DOS DADOS
  // ===========================================================================

  /**
   * Confere os dados antes de desenhar e lança um erro com a causa do primeiro
   * problema. Regras: `id` único e não vazio; `nome` preenchido; `dimensao`
   * (se existir) igual a 'legislativa' ou 'administrativa'; `filhos` é uma lista.
   */
  function validarArvore(raiz) {
    if (!raiz || typeof raiz !== 'object') {
      throw new Error('Dados ausentes: window.organogramaDados não foi definido.');
    }

    const ids = new Set();

    (function visitar(no, caminho) {
      const rotuloNo = `"${no && no.nome ? no.nome : '?'}" (${caminho})`;

      if (typeof no.id !== 'string' || no.id.trim() === '') {
        throw new Error(`Nó sem id válido: ${rotuloNo}.`);
      }
      if (ids.has(no.id)) {
        throw new Error(`Id duplicado "${no.id}": ${rotuloNo}.`);
      }
      ids.add(no.id);

      if (typeof no.nome !== 'string' || no.nome.trim() === '') {
        throw new Error(`Nó "${no.id}" sem nome.`);
      }
      if (no.dimensao !== undefined && !Object.prototype.hasOwnProperty.call(ROTULOS_DIMENSAO, no.dimensao)) {
        throw new Error(`Dimensão desconhecida "${no.dimensao}" no nó "${no.id}". Use 'legislativa' ou 'administrativa'.`);
      }
      if (no.filhos !== undefined && !Array.isArray(no.filhos)) {
        throw new Error(`O campo "filhos" do nó "${no.id}" precisa ser uma lista.`);
      }
      (no.filhos || []).forEach((filho, i) => visitar(filho, `${caminho} > filho ${i + 1}`));
    }(raiz, 'raiz'));
  }

  /** Troca o diagrama por um aviso de erro (textContent: o texto vem dos dados). */
  function mostrarErroDeDados(palco, erro) {
    const aviso = document.createElement('p');
    aviso.setAttribute('role', 'alert');
    aviso.className = 'erro-dados';
    aviso.textContent = `Não foi possível exibir o organograma: ${erro.message}`;
    palco.replaceChildren(aviso);
  }

  // ===========================================================================
  // 3. MONTAGEM
  // ===========================================================================

  /**
   * Monta o organograma na página (chamada por organograma-perfil.js).
   * `opcoes.perfil(largura)` devolve os números de layout da tela.
   */
  function montar(opcoes) {
    const palco = opcoes.palco || document.getElementById('organograma');
    const perfil = opcoes.perfil;
    const dados = opcoes.dados || global.organogramaDados;

    // Dados inválidos: mostra o erro na tela em vez de desenhar um diagrama quebrado.
    try {
      validarArvore(dados);
    } catch (erro) {
      console.error('[organograma] dados inválidos:', erro.message);
      mostrarErroDeDados(palco, erro);
      return null;
    }

    // Se o sistema pede menos movimento, a animação é desligada.
    const menosMovimento = global.matchMedia('(prefers-reduced-motion: reduce)');

    // Hierarquia do D3: dá pai, filhos, profundidade e ancestrais de cada nó.
    const hierarquia = d3.hierarchy(dados, (d) => d.filhos);
    const porId = new Map();
    hierarquia.each((n) => porId.set(n.data.id, n));
    const temFilhos = (n) => Boolean(n.children && n.children.length);

    // Cards abertos no momento. A raiz fica sempre aberta.
    const expandidos = new Set(lerEstado());
    expandidos.add(hierarquia.data.id);

    let focoId = hierarquia.data.id; // card que recebe o foco do teclado
    let perfilAtual = null;          // perfil usado no último layout
    let atual = new Map();           // id -> posição e tamanho exibidos agora
    let caixaAtual = { w: 0, h: 0 }; // tamanho exibido do diagrama
    let temporizador = null;         // animação em curso
    let aoConcluir = [];             // funções a rodar quando a animação terminar
    let animando = false;            // true só durante a animação
    const alturas = new Map();       // id -> altura do card, medida no DOM
    const elementos = new Map();     // id -> elemento HTML do card

    palco.setAttribute('role', 'tree');
    palco.setAttribute('aria-label', 'Organograma institucional');
    const svg = d3.select(palco).append('svg')
      .attr('class', 'conectores')
      .attr('aria-hidden', 'true') // linhas são só visuais
      .attr('focusable', 'false');
    const anuncio = document.getElementById('anuncio');

    // ---------- estado salvo (cards abertos) ----------

    /** Lê do navegador os ids abertos na última visita (ignora ids que não existem mais). */
    function lerEstado() {
      try {
        const ids = JSON.parse(global.sessionStorage.getItem(CHAVE_ESTADO) || '[]');
        return Array.isArray(ids) ? ids.filter((id) => porId.has(id) && temFilhos(porId.get(id))) : [];
      } catch (e) {
        return [];
      }
    }

    function salvarEstado() {
      try {
        global.sessionStorage.setItem(CHAVE_ESTADO, JSON.stringify([...expandidos]));
      } catch (e) { /* sem armazenamento: segue sem salvar */ }
    }

    /** Lista os cards visíveis, na ordem de leitura (pai antes dos filhos). */
    function coletarVisiveis() {
      const lista = [];
      (function descer(n) {
        lista.push(n);
        if (expandidos.has(n.data.id) && temFilhos(n)) n.children.forEach(descer);
      }(hierarquia));
      return lista;
    }

    /** Largura do card (igual para todos; sempre inteira para o texto não ficar borrado). */
    const larguraCard = (n, p) => Math.min(p.maxWidth, Math.round(p.cardWidth));

    // ---------- DOM dos cards ----------

    /** Texto lido por leitor de tela ao focar o card: nome, sigla, dimensão e se é macrounidade. */
    function rotuloAcessivel(n) {
      const d = n.data;
      const partes = [d.nome + (d.sigla ? ` (${d.sigla})` : ''), ROTULOS_DIMENSAO[dimensaoDe(d)]];
      if (d.macro) partes.push('macrounidade');
      return partes.join(', ');
    }

    /**
     * Cria o HTML de cada card novo. EDITAR AQUI para mudar o que aparece dentro
     * do card (hoje: sigla, nome e seta).
     */
    function criarCard(selecao) {
      return selecao.append('div')
        // dim-legislativa / dim-administrativa definem a cor; `macro` o destaque (ver css, seção 5).
        .attr('class', (n) => `card dim-${dimensaoDe(n.data)}${n.data.macro ? ' macro' : ''}`)
        .attr('role', 'treeitem')
        .style('opacity', 0) // nasce invisível; a animação o revela
        .each(function (n) {
          const d = n.data;
          const el = d3.select(this);
          el.attr('data-id', d.id);
          if (d.sigla) el.append('span').attr('class', 'card-sigla').text(d.sigla);
          el.append('span').attr('class', 'card-nome').text(d.nome);
          if (temFilhos(n)) {
            // Seta: indica que o card abre e fecha.
            el.append('span').attr('class', 'card-acao').attr('aria-hidden', 'true')
              .append('span').attr('class', 'seta');
          }
          elementos.set(d.id, this);
        });
    }

    /** Cria os cards que faltam e remove os que sobraram (reaproveita os existentes). */
    function sincronizarDOM(manter) {
      const lista = hierarquia.descendants().filter((n) => manter.has(n.data.id));
      d3.select(palco).selectAll('.card').data(lista, (n) => n.data.id).join(
        (enter) => criarCard(enter),
        (update) => update,
        (exit) => exit.each(function () { elementos.delete(this.dataset.id); }).remove()
      ).order(); // mantém a ordem de leitura

      svg.selectAll('path.aresta').data(lista.filter((n) => n.parent), (n) => n.data.id).join(
        (enter) => enter.append('path').attr('class', 'aresta'),
        (update) => update,
        (exit) => exit.remove()
      );
    }

    /** Atualiza os atributos de acessibilidade dos cards visíveis e esconde os que estão saindo. */
    function atualizarAtributos(visiveis) {
      const ids = new Set(visiveis.map((n) => n.data.id));
      // Se o card focado sumiu, o foco volta para a raiz.
      if (!ids.has(focoId)) focoId = hierarquia.data.id;

      visiveis.forEach((n) => {
        const el = elementos.get(n.data.id);
        const irmaos = n.parent ? n.parent.children : [n];
        el.classList.remove('saindo');
        d3.select(el)
          .attr('aria-hidden', null)
          .attr('tabindex', n.data.id === focoId ? 0 : -1)
          .attr('aria-label', rotuloAcessivel(n))
          .attr('aria-level', n.depth + 1)
          .attr('aria-setsize', irmaos.length)
          .attr('aria-posinset', irmaos.indexOf(n) + 1)
          .attr('aria-expanded', temFilhos(n) ? String(expandidos.has(n.data.id)) : null)
          .classed('expansivel', temFilhos(n));
      });

      atual.forEach((e, id) => {
        if (ids.has(id)) return;
        const el = elementos.get(id);
        if (!el) return;
        el.classList.add('saindo');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('tabindex', '-1');
      });
    }

    /** Mede a altura real de cada card (depende do texto), pois o layout precisa dela. */
    function medir(nos, p) {
      nos.forEach((n) => {
        const el = elementos.get(n.data.id);
        el.style.width = `${larguraCard(n, p)}px`;
        el.style.height = '';
        el.__altura = null;
      });
      nos.forEach((n) => {
        // Altura inteira: evita bordas e texto embaçados.
        alturas.set(n.data.id, Math.ceil(elementos.get(n.data.id).getBoundingClientRect().height - 0.01));
      });
    }

    // ---------- layout e animação ----------

    /** Monta a árvore só com o que o layout precisa (id, tamanho e filhos visíveis). */
    function arvoreLayout(n, p) {
      const id = n.data.id;
      return {
        id,
        w: larguraCard(n, p),
        h: alturas.get(id),
        children: expandidos.has(id) && temFilhos(n) ? n.children.map((c) => arvoreLayout(c, p)) : []
      };
    }

    /** Ancestral mais próximo que está no conjunto `existe` (ou null). */
    function ancestralPresente(id, existe) {
      let n = porId.get(id).parent;
      while (n && !existe.has(n.data.id)) n = n.parent;
      return n ? n.data.id : null;
    }

    /** Em telas muito estreitas, reduz espaços para sempre caber ao menos um card por linha. */
    function ajustarPerfil(p) {
      const niveis = Math.max(1, hierarquia.height);
      const gutter = Math.min(p.gutter, Math.max(GUTTER_MINIMO, Math.floor((p.maxWidth - RESERVA_CARDS_POR_LINHA) / niveis)));
      const cardWidth = Math.max(LARGURA_MINIMA_CARD, Math.min(p.cardWidth, p.maxWidth - gutter * niveis));
      return { ...p, gutter, cardWidth };
    }

    /**
     * Recalcula e anima o layout. É chamada a cada mudança (abrir, fechar, redimensionar).
     * Opções: `ancora` (id do card que fica parado na tela), `instantaneo` (sem animação),
     * `remedir` (mede os cards de novo) e `depois` (função a rodar ao terminar).
     */
    function reorganizar(op) {
      const opts = op || {};
      const p = ajustarPerfil(perfil(palco.clientWidth));
      const visiveis = coletarVisiveis();
      const idsVisiveis = new Set(visiveis.map((n) => n.data.id));
      // Cards que estão saindo continuam na tela até a animação terminar.
      const manter = new Set([...idsVisiveis, ...atual.keys()]);

      sincronizarDOM(manter);
      atualizarAtributos(visiveis);

      // Só mede todos se a largura mudou; senão mede apenas os novos.
      const refazerTudo = opts.remedir || !perfilAtual || perfilAtual.cardWidth !== p.cardWidth;
      perfilAtual = p;
      medir(refazerTudo ? visiveis : visiveis.filter((n) => !alturas.has(n.data.id) || !atual.has(n.data.id)), p);

      // Posições calculadas por organograma-layout.js.
      const layout = Layout.compute(arvoreLayout(hierarquia, p), p);
      iniciarTransicao(layout, idsVisiveis, p, opts);
    }

    /** Converte o resultado do layout em valores finais da animação, por card. */
    function valoresAlvo(layout) {
      const alvos = new Map();
      layout.nodes.forEach((nd, id) => {
        alvos.set(id, { x: nd.x, y: nd.y, w: nd.w, h: nd.h, op: 1, b0: 0, bR: 0, tx: 0, pid: nd.parentId });
      });
      layout.edges.forEach((ed) => {
        const filho = alvos.get(ed.to);
        const pai = layout.nodes.get(ed.from);
        const base = pai.y + pai.h;
        filho.b0 = ed.bus0 - base;
        filho.bR = ed.busR - base;
        filho.tx = ed.trunkX == null ? 0 : ed.trunkX - (pai.x + pai.w / 2);
      });
      return alvos;
    }

    /** Anima os cards e conectores da posição atual até a calculada. */
    function iniciarTransicao(layout, idsVisiveis, p, opts) {
      if (temporizador) temporizador.stop();
      definirAnimando(false);
      // Se interrompe outra animação, o `depois` da anterior roda ao fim desta.
      if (opts.depois) aoConcluir.push(opts.depois);

      const alvos = valoresAlvo(layout);
      const existentes = new Set(atual.keys());
      const saindo = [];
      atual.forEach((e, id) => { if (!alvos.has(id)) saindo.push(id); });

      // Quem sai recolhe para dentro do ancestral visível; quem entra nasce dele.
      saindo.forEach((id) => {
        const a = alvos.get(ancestralPresente(id, idsVisiveis)) || [...alvos.values()][0];
        const e = atual.get(id);
        alvos.set(id, { x: a.x + a.w / 2 - e.w / 2, y: a.y, w: e.w, h: e.h, op: 0, b0: 0, bR: 0, tx: 0, pid: e.pid });
      });

      const origem = new Map();
      alvos.forEach((alvo, id) => {
        if (atual.has(id)) {
          origem.set(id, { ...atual.get(id) });
          return;
        }
        const n = porId.get(id);
        const pai = ancestralPresente(id, existentes);
        const base = pai ? atual.get(pai) : alvo;
        origem.set(id, {
          x: base.x + base.w / 2 - alvo.w / 2, y: base.y, w: alvo.w, h: alvo.h,
          op: 0, b0: 0, bR: 0, tx: 0, pid: n.parent ? n.parent.data.id : null
        });
      });

      const caixaOrigem = { ...caixaAtual };
      const caixaAlvo = { w: layout.width, h: layout.height };
      const ancora = opts.ancora && atual.has(opts.ancora) ? opts.ancora : null;
      let yAncora = ancora ? atual.get(ancora).y : 0;
      // Sem animação: pedido da chamada, preferência do sistema ou primeira pintura.
      const duracao = opts.instantaneo || menosMovimento.matches || !existentes.size ? 0 : DURACAO_MS;

      /** Um quadro da animação. */
      function quadro(t) {
        origem.forEach((o, id) => {
          const a = alvos.get(id);
          atual.set(id, {
            x: lerp(o.x, a.x, t), y: lerp(o.y, a.y, t), w: lerp(o.w, a.w, t), h: lerp(o.h, a.h, t),
            op: lerp(o.op, a.op, t), b0: lerp(o.b0, a.b0, t), bR: lerp(o.bR, a.bR, t), tx: lerp(o.tx, a.tx, t),
            pid: a.pid
          });
        });
        caixaAtual = { w: lerp(caixaOrigem.w, caixaAlvo.w, t), h: lerp(caixaOrigem.h, caixaAlvo.h, t) };
        desenhar(p);

        // Mantém o card clicado parado na tela enquanto o resto se move.
        if (ancora && atual.has(ancora)) {
          const y = atual.get(ancora).y;
          if (Math.abs(y - yAncora) > 0.5) {
            global.scrollBy(0, y - yAncora);
            yAncora = y;
          }
        }
      }

      /** Fim da animação: remove quem saiu e fixa o estado final. */
      function concluir() {
        saindo.forEach((id) => atual.delete(id));
        sincronizarDOM(new Set(atual.keys()));
        definirAnimando(false);
        desenhar(p);
        temporizador = null;
        const pendentes = aoConcluir;
        aoConcluir = [];
        pendentes.forEach((f) => f());
      }

      if (duracao === 0) {
        quadro(1);
        concluir();
        return;
      }
      definirAnimando(true);
      temporizador = d3.timer((tempo) => {
        const t = Math.min(1, tempo / duracao);
        quadro(d3.easeCubicInOut(t));
        if (t >= 1) {
          temporizador.stop();
          concluir();
        }
      });
    }

    /** Liga/desliga o modo "animando" (só durante o movimento os cards usam camada de GPU). */
    function definirAnimando(ligado) {
      animando = ligado;
      palco.classList.toggle('animando', ligado);
    }

    /** Posiciona os cards e redesenha os conectores. Roda a cada quadro da animação. */
    function desenhar(p) {
      // Centraliza o diagrama quando ele é mais estreito que a página.
      const larguraPalco = palco.clientWidth;
      const deslocamento = Math.max(0, (larguraPalco - caixaAtual.w) / 2);
      // Lê as medidas antes de escrever no DOM (mais rápido).
      const caixaPalco = palco.getBoundingClientRect();
      const dpr = global.devicePixelRatio || 1;
      // Alinha a posição à grade de pixels da tela (texto nítido em zoom e telas HiDPI).
      const alinhar = (v, origem) => Math.round((origem + v) * dpr) / dpr - origem;
      // Altura explícita: cards absolutos não empurram a página sozinhos.
      palco.style.height = `${Math.ceil(caixaAtual.h)}px`;

      const caminhos = new Map();
      svg.selectAll('path.aresta').each(function (n) { caminhos.set(n.data.id, this); });

      atual.forEach((e, id) => {
        const el = elementos.get(id);
        if (!el) return;
        // Durante a animação o movimento suave vale mais; em repouso alinha à grade de pixels.
        const x = deslocamento + e.x;
        const tx = animando ? x : alinhar(x, caixaPalco.left + global.scrollX);
        const ty = animando ? e.y : alinhar(e.y, caixaPalco.top + global.scrollY);
        el.style.transform = `translate(${tx}px, ${ty}px)`;
        el.style.opacity = e.op;
        const h = Math.round(e.h * 10) / 10;
        if (el.__altura !== h) {
          el.style.height = `${h}px`;
          el.__altura = h;
        }
        const pai = e.pid ? atual.get(e.pid) : null;
        const caminho = caminhos.get(id);
        if (pai && caminho) {
          const px = deslocamento + pai.x + pai.w / 2;
          const base = pai.y + pai.h;
          const pts = Layout.pontosAresta(
            px, base, deslocamento + e.x + e.w / 2, e.y, base + e.b0, base + e.bR, px + e.tx
          );
          caminho.setAttribute('d', Layout.caminhoArredondado(pts, p.radius || 10));
          caminho.style.opacity = e.op;
        }
      });
    }

    // ===========================================================================
    // 4. AÇÕES (clique, teclado, botões)
    // ===========================================================================

    /** Escreve na região que leitores de tela anunciam (#anuncio). */
    function anunciar(texto) {
      if (anuncio) anuncio.textContent = texto;
    }

    /** Define qual card recebe o foco do teclado (só um card fica na ordem de Tab). */
    function definirFoco(id, mover) {
      focoId = id;
      elementos.forEach((el, k) => el.setAttribute('tabindex', k === id ? '0' : '-1'));
      if (mover) elementos.get(id).focus();
    }

    /**
     * Acordeão (só no celular, ver organograma-perfil.js): ao abrir um filho direto
     * da raiz, fecha os outros. Devolve true se fechou algum.
     */
    function aplicarAcordeao(n) {
      if (!perfilAtual || !perfilAtual.acordeaoRaizes || n.parent !== hierarquia) return false;
      let fechou = false;
      n.parent.children.forEach((irmao) => {
        if (irmao === n) return;
        if (expandidos.has(irmao.data.id)) fechou = true;
        irmao.each((d) => expandidos.delete(d.data.id));
      });
      return fechou;
    }

    /** Abre ou fecha um card. */
    function alternar(id) {
      const n = porId.get(id);
      if (!temFilhos(n)) return;
      const abrir = !expandidos.has(id);
      let fechouIrmaos = false;

      if (abrir) {
        expandidos.add(id);
        fechouIrmaos = aplicarAcordeao(n);
      } else {
        n.each((d) => expandidos.delete(d.data.id)); // fechar também fecha os descendentes
        if (n.data.id === hierarquia.data.id) expandidos.add(id); // a raiz não fecha
      }
      salvarEstado();
      reorganizar({ ancora: id });
      anunciar(`${n.data.nome} ${abrir ? 'expandido' : 'recolhido'}`
        + (fechouIrmaos ? '. As outras seções foram recolhidas' : ''));
    }

    /** Botão "Expandir tudo". */
    function expandirTudo() {
      hierarquia.each((n) => { if (temFilhos(n)) expandidos.add(n.data.id); });
      salvarEstado();
      reorganizar({ ancora: hierarquia.data.id });
      anunciar(`Todos os ${porId.size} cards estão visíveis`);
    }

    /** Botão "Expandir próximo nível": abre o nível mais raso que ainda tem cards fechados. */
    function expandirProximoNivel() {
      const visiveis = coletarVisiveis();
      const fechados = visiveis.filter((n) => temFilhos(n) && !expandidos.has(n.data.id));
      if (fechados.length === 0) {
        anunciar('Todos os níveis já estão expandidos');
        return;
      }
      const nivel = Math.min(...fechados.map((n) => n.depth));
      fechados.filter((n) => n.depth === nivel).forEach((n) => expandidos.add(n.data.id));

      const novos = coletarVisiveis().length - visiveis.length;
      salvarEstado();
      reorganizar({ ancora: hierarquia.data.id });
      anunciar(`Próximo nível expandido, ${novos} novos cards visíveis`);
    }

    /** Botão "Recolher tudo". */
    function recolherTudo() {
      expandidos.clear();
      expandidos.add(hierarquia.data.id);
      definirFoco(hierarquia.data.id, false);
      salvarEstado();
      reorganizar({ ancora: hierarquia.data.id });
      anunciar('Organograma recolhido');
    }

    /** Realça o caminho do card até a raiz ao passar o mouse ou focar. `null` limpa. */
    function destacar(id) {
      const cadeia = id ? new Set(porId.get(id).ancestors().map((a) => a.data.id)) : null;
      svg.selectAll('path.aresta')
        .classed('destaque', (n) => Boolean(cadeia && cadeia.has(n.data.id)))
        .filter('.destaque').raise();
      d3.select(palco).selectAll('.card')
        .classed('ancestral', (n) => Boolean(cadeia && cadeia.has(n.data.id) && n.data.id !== id));
    }

    /** Id do card que originou o evento (ignora cards saindo). */
    const idDoEvento = (e) => {
      const el = e.target.closest && e.target.closest('.card');
      return el && !el.classList.contains('saindo') ? el.dataset.id : null;
    };

    // Um único ouvinte no palco atende todos os cards (inclusive os criados depois).
    palco.addEventListener('click', (e) => {
      const id = idDoEvento(e);
      if (!id) return;
      definirFoco(id, false);
      elementos.get(id).focus({ preventScroll: true });
      alternar(id);
    });
    palco.addEventListener('pointerover', (e) => destacar(idDoEvento(e)));
    palco.addEventListener('pointerleave', () => destacar(document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.id : null));
    palco.addEventListener('focusin', (e) => destacar(idDoEvento(e)));
    palco.addEventListener('focusout', () => destacar(null));

    // Teclado: ↑/↓ percorrem os cards; → abre (ou entra no 1º filho); ← fecha (ou sobe ao
    // pai); Enter/Espaço abrem e fecham; Home/End vão ao primeiro/último.
    palco.addEventListener('keydown', (e) => {
      const id = idDoEvento(e);
      if (!id) return;
      const n = porId.get(id);
      const visiveis = coletarVisiveis();
      const i = visiveis.indexOf(n);
      let destino = null;
      switch (e.key) {
        case 'ArrowDown': destino = visiveis[Math.min(i + 1, visiveis.length - 1)]; break;
        case 'ArrowUp': destino = visiveis[Math.max(i - 1, 0)]; break;
        case 'Home': destino = visiveis[0]; break;
        case 'End': destino = visiveis[visiveis.length - 1]; break;
        case 'ArrowRight':
          if (temFilhos(n) && !expandidos.has(id)) alternar(id);
          else if (temFilhos(n)) destino = n.children[0];
          break;
        case 'ArrowLeft':
          if (temFilhos(n) && expandidos.has(id) && n.parent) alternar(id);
          else if (n.parent) destino = n.parent;
          break;
        case 'Enter':
        case ' ': alternar(id); break;
        default: return; // outras teclas seguem o padrão do navegador
      }
      e.preventDefault(); // evita rolar a página com setas e Espaço
      if (destino) definirFoco(destino.data.id, true);
    });

    // ---------- botões da barra ----------

    /** Cada botão do index.html escolhe sua ação pelo atributo data-acao. */
    const acoesDaBarra = {
      'expandir-nivel': expandirProximoNivel,
      'expandir-tudo': expandirTudo,
      'recolher-tudo': recolherTudo
    };
    document.querySelectorAll('[data-acao]').forEach((botao) => {
      const acao = acoesDaBarra[botao.dataset.acao];
      if (acao) botao.addEventListener('click', acao);
    });

    // ===========================================================================
    // 5. REDIMENSIONAR
    // ===========================================================================

    let larguraAnterior = palco.clientWidth;
    let agendado = false;

    /** Refaz o layout quando a largura da página muda (mudanças só de altura são ignoradas). */
    function aoRedimensionar() {
      const w = palco.clientWidth;
      if (Math.abs(w - larguraAnterior) < 1 || agendado) return;
      larguraAnterior = w;
      agendado = true;
      global.requestAnimationFrame(() => {
        agendado = false;
        reorganizar({ instantaneo: true });
      });
    }
    if ('ResizeObserver' in global) new global.ResizeObserver(aoRedimensionar).observe(palco);
    else global.addEventListener('resize', aoRedimensionar);

    // Quando as fontes carregam, o texto muda de largura: mede os cards de novo.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => reorganizar({ instantaneo: true, remedir: true }));
      if (document.fonts.addEventListener) {
        document.fonts.addEventListener('loadingdone', () => reorganizar({ instantaneo: true, remedir: true }));
      }
    }

    reorganizar({ instantaneo: true });

    return { alternar, expandirTudo, expandirProximoNivel, recolherTudo, expandidos, porId };
  }

  global.Organograma = { montar, validarArvore, ROTULOS_DIMENSAO };
}(window));
