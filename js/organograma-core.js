/**
 * @file Núcleo do organograma - compartilhado por desktop e mobile.
 *
 * Fluxo de dados (da esquerda para a direita):
 *
 *   dados ─► validarArvore ─► d3.hierarchy ─► nós visíveis ─► medir cards
 *         ─► OrganogramaLayout.compute ─► transição (cards HTML + conectores SVG)
 *
 * Divisão de responsabilidades (para saber onde mexer):
 *   - organograma-layout.js   ONDE cada card fica (matemática pura, sem DOM);
 *   - este arquivo            COMO desenhar, animar e reagir a cliques/teclado;
 *   - organograma-busca.js    busca textual (só conversa com este arquivo via irPara);
 *   - organograma-desktop.js / -mobile.js   "perfil": números que diferenciam as telas.
 *
 * Por que cards em HTML e linhas em SVG? Texto em HTML quebra linha, é selecionável,
 * foca por teclado e é lido por leitores de tela; já os conectores são geometria,
 * onde o SVG é a ferramenta natural. Os dois ficam no mesmo contêiner e são
 * posicionados a cada quadro da animação, por isso nunca se descolam.
 */
(function (global) {
  'use strict';

  const d3 = global.d3;
  const Layout = global.OrganogramaLayout;

  /**
   * Parâmetros que variam entre telas. Cada perfil (desktop/mobile) devolve um objeto assim.
   *
   * @typedef {object} Perfil
   * @property {number} maxWidth Largura máxima (px) que o diagrama pode ocupar.
   * @property {number} cardWidth Largura base (px) dos cards.
   * @property {number} gapX Espaço horizontal (px) entre cards irmãos.
   * @property {number} groupGap Espaço extra (px) entre irmãos que têm filhos (separa grupos).
   * @property {number} gapY Espaço vertical (px) entre níveis.
   * @property {number} gutter Corredor (px) reservado ao "tronco" quando os filhos quebram em linhas.
   * @property {number} [radius] Arredondamento (px) dos cantos dos conectores.
   * @property {boolean} [acordeaoRaizes] Se true, abrir um filho direto da raiz fecha os demais.
   */

  /**
   * Nome exibido para cada "tipo" que aparece nos dados. Ao criar um tipo novo,
   * inclua-o aqui (e crie a regra `.card-<tipo>` em css/organograma.css).
   * É também a lista usada para validar os dados: tipo fora daqui é erro.
   */
  const ROTULOS_TIPO = Object.freeze({
    instituicao: 'Instituição',
    orgao: 'Órgão',
    gabinete: 'Gabinete',
    diretoria: 'Diretoria',
    coordenadoria: 'Coordenadoria',
    gerencia: 'Gerência',
    chefia: 'Chefia',
    assessoria: 'Assessoria',
    unidade: 'Unidade',
    cargo: 'Cargo',
    comissao: 'Comissão',
    ouvidoria: 'Ouvidoria'
  });

  /** Duração da animação de expandir/recolher (ms). Curta o bastante para não irritar. */
  const DURACAO_MS = 380;

  /** Chave do sessionStorage: guarda quais cards estavam abertos ao trocar de página/versão. */
  const CHAVE_ESTADO = 'organograma:expandidos';

  /** Folga mínima (px) que cada nível reserva ao tronco; ver `ajustarPerfil`. */
  const LARGURA_MINIMA_CARD = 96;
  const GUTTER_MINIMO = 8;
  const RESERVA_CARDS_POR_LINHA = 112;

  /** Interpolação linear: valor entre `a` e `b` na posição `t` (0 a 1). */
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------------------------------------------------------------------
  // Validação dos dados
  // ---------------------------------------------------------------------------

  /**
   * Confere a árvore ANTES de qualquer desenho e lança um Error descritivo no
   * primeiro problema. Motivo: dados com id repetido ou atalho quebrado não dão
   * erro na hora - produzem um diagrama errado em silêncio, o pior tipo de falha
   * para quem mantém o arquivo de dados.
   *
   * Regras: id é string não vazia e único; nome é string não vazia; tipo existe
   * em ROTULOS_TIPO; filhos (se houver) é lista; targetId aponta para um id existente.
   * Um objeto reaproveitado em dois lugares (ciclo) também cai na regra de id único.
   *
   * @param {object} raiz Nó raiz dos dados (`window.organogramaDados`).
   * @param {Record<string, string>} rotulos Tipos válidos.
   * @returns {void}
   * @throws {Error} Mensagem em português indicando o nó e o problema.
   */
  function validarArvore(raiz, rotulos) {
    if (!raiz || typeof raiz !== 'object') {
      throw new Error('Dados ausentes: window.organogramaDados não foi definido.');
    }

    const ids = new Set();
    const alvos = [];

    // Primeira passada: valida cada nó e coleta todos os ids.
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
      if (!Object.prototype.hasOwnProperty.call(rotulos, no.tipo)) {
        throw new Error(`Tipo desconhecido "${no.tipo}" no nó "${no.id}". Cadastre-o em ROTULOS_TIPO.`);
      }
      if (no.targetId !== undefined) alvos.push({ id: no.id, targetId: no.targetId });

      if (no.filhos !== undefined && !Array.isArray(no.filhos)) {
        throw new Error(`O campo "filhos" do nó "${no.id}" precisa ser uma lista.`);
      }
      (no.filhos || []).forEach((filho, i) => visitar(filho, `${caminho} > filho ${i + 1}`));
    }(raiz, 'raiz'));

    // Segunda passada: atalhos só podem ser conferidos depois de conhecer todos os ids.
    alvos.forEach(({ id, targetId }) => {
      if (!ids.has(targetId)) {
        throw new Error(`O atalho do nó "${id}" aponta para "${targetId}", que não existe.`);
      }
    });
  }

  /**
   * Substitui o diagrama por um aviso acessível. Usa textContent (não innerHTML)
   * porque a mensagem inclui texto vindo dos dados.
   *
   * @param {HTMLElement} palco Contêiner do diagrama.
   * @param {Error} erro Erro de validação.
   */
  function mostrarErroDeDados(palco, erro) {
    const aviso = document.createElement('p');
    aviso.setAttribute('role', 'alert');
    aviso.className = 'erro-dados';
    aviso.textContent = `Não foi possível exibir o organograma: ${erro.message}`;
    palco.replaceChildren(aviso);
  }

  // ---------------------------------------------------------------------------
  // Montagem do componente
  // ---------------------------------------------------------------------------

  /**
   * Monta o organograma dentro da página.
   *
   * @param {object} opcoes
   * @param {(larguraDoPalco: number) => Perfil} opcoes.perfil Função que devolve o perfil da tela.
   * @param {HTMLElement} [opcoes.palco] Contêiner (padrão: #organograma).
   * @param {object} [opcoes.dados] Árvore de dados (padrão: window.organogramaDados).
   * @returns {object | null} API pública, ou null se os dados forem inválidos.
   */
  function montar(opcoes) {
    const palco = opcoes.palco || document.getElementById('organograma');
    const perfil = opcoes.perfil;
    const dados = opcoes.dados || global.organogramaDados;

    // Falha cedo e de forma visível: não tenta desenhar uma árvore quebrada.
    try {
      validarArvore(dados, ROTULOS_TIPO);
    } catch (erro) {
      console.error('[organograma] dados inválidos:', erro.message);
      mostrarErroDeDados(palco, erro);
      return null;
    }

    // Respeita a preferência do sistema por menos movimento (acessibilidade).
    const menosMovimento = global.matchMedia('(prefers-reduced-motion: reduce)');

    // Cria a hierarquia a partir dos dados: d3.hierarchy dá pai, filhos, profundidade e ancestrais.
    const hierarquia = d3.hierarchy(dados, (d) => d.filhos);
    const porId = new Map();
    hierarquia.each((n) => porId.set(n.data.id, n));
    const temFilhos = (n) => Boolean(n.children && n.children.length);

    // Estado: quais cards estão abertos. A raiz fica sempre aberta (sem ela não há diagrama).
    const expandidos = new Set(lerEstado());
    expandidos.add(hierarquia.data.id);

    let focoId = hierarquia.data.id; // único card com tabindex=0 (padrão "roving tabindex")
    let perfilAtual = null;          // perfil usado no último layout
    let atual = new Map();           // id -> valores EXIBIDOS agora (mudam a cada quadro)
    let caixaAtual = { w: 0, h: 0 }; // tamanho exibido do diagrama (animado também)
    let temporizador = null;         // d3.timer da transição em curso
    let aoConcluir = [];             // callbacks `depois` ainda não executados (sobrevivem a transições interrompidas)
    let animando = false;            // true só enquanto uma transição roda (ver definirAnimando)
    const alturas = new Map();       // id -> altura natural do card, medida no DOM
    const elementos = new Map();     // id -> elemento HTML do card

    palco.setAttribute('role', 'tree');
    palco.setAttribute('aria-label', 'Organograma institucional');
    const svg = d3.select(palco).append('svg')
      .attr('class', 'conectores')
      .attr('aria-hidden', 'true') // linhas são decorativas; a hierarquia já está em aria-level/expanded
      .attr('focusable', 'false');
    const anuncio = document.getElementById('anuncio');

    // ---------- estado persistido ----------

    /**
     * Lê do sessionStorage os ids abertos, descartando os que não existem mais
     * (os dados podem ter mudado entre visitas). Qualquer falha de armazenamento
     * é ignorada: modo privado/bloqueado não pode quebrar o organograma.
     *
     * @returns {string[]} Ids que devem começar abertos.
     */
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
      } catch (e) { /* armazenamento indisponível: segue sem persistir */ }
    }

    /**
     * Lista os nós visíveis em pré-ordem (pai antes dos filhos = ordem de leitura,
     * também usada pela navegação por setas).
     *
     * @returns {object[]} Nós d3.hierarchy visíveis.
     */
    function coletarVisiveis() {
      const lista = [];
      (function descer(n) {
        lista.push(n);
        if (expandidos.has(n.data.id) && temFilhos(n)) n.children.forEach(descer);
      }(hierarquia));
      return lista;
    }

    /**
     * Largura do card, igual para TODOS os tipos (a diferença entre tipos é só de
     * cor), nunca maior que o espaço disponível. Sempre inteira: largura
     * fracionária desfoca o texto.
     */
    const larguraCard = (n, p) => Math.min(p.maxWidth, Math.round(p.cardWidth));

    // ---------- DOM dos cards ----------

    /**
     * Texto lido pelo leitor de tela ao focar o card: nome, sigla, tipo, quantidade
     * de subunidades e, se for atalho, o destino. Sem isso o leitor leria só o
     * conteúdo visual, sem a informação de que o card abre algo.
     */
    function rotuloAcessivel(n) {
      const d = n.data;
      const partes = [d.nome + (d.sigla ? ` (${d.sigla})` : ''), ROTULOS_TIPO[d.tipo]];
      if (temFilhos(n)) {
        const q = n.children.length;
        partes.push(`${q} ${q === 1 ? 'subunidade' : 'subunidades'}`);
      }
      if (d.targetId && porId.has(d.targetId)) partes.push(`atalho para ${porId.get(d.targetId).data.nome}`);
      return partes.join(', ');
    }

    /** Cria o HTML de cada card novo (apenas o que entra; os existentes são reaproveitados). */
    function criarCard(selecao) {
      return selecao.append('div')
        .attr('class', (n) => `card card-${n.data.tipo}`)
        .attr('role', 'treeitem')
        .style('opacity', 0) // nasce invisível; a transição o revela
        .each(function (n) {
          const d = n.data;
          const el = d3.select(this);
          el.attr('data-id', d.id);
          if (d.sigla) el.append('span').attr('class', 'card-sigla').text(d.sigla);
          el.append('span').attr('class', 'card-nome').text(d.nome);
          el.append('span').attr('class', 'card-tipo').text(ROTULOS_TIPO[d.tipo]);
          if (temFilhos(n)) {
            // Indicador "seta + quantidade": avisa que o card abre e quantos filhos tem.
            const acao = el.append('span').attr('class', 'card-acao').attr('aria-hidden', 'true');
            acao.append('span').attr('class', 'seta');
            acao.append('span').text(n.children.length);
          } else if (d.targetId && porId.has(d.targetId)) {
            el.append('span').attr('class', 'card-acao card-atalho').attr('aria-hidden', 'true')
              .text(`Ir para ${porId.get(d.targetId).data.nome}`);
          }
          elementos.set(d.id, this);
        });
    }

    /**
     * Sincroniza o DOM com o conjunto `manter`: cria o que falta e remove o que sobrou.
     * Usa o padrão enter/update/exit do D3 com chave por id, para reaproveitar elementos
     * (e não recriar a página inteira a cada clique - requisito de desempenho).
     *
     * @param {Set<string>} manter Ids que devem existir no DOM.
     */
    function sincronizarDOM(manter) {
      const lista = hierarquia.descendants().filter((n) => manter.has(n.data.id));
      d3.select(palco).selectAll('.card').data(lista, (n) => n.data.id).join(
        (enter) => criarCard(enter),
        (update) => update,
        (exit) => exit.each(function () { elementos.delete(this.dataset.id); }).remove()
      ).order(); // mantém a ordem do DOM = ordem de leitura (importa para leitores de tela)

      svg.selectAll('path.aresta').data(lista.filter((n) => n.parent), (n) => n.data.id).join(
        (enter) => enter.append('path').attr('class', 'aresta'),
        (update) => update,
        (exit) => exit.remove()
      );
    }

    /**
     * Atualiza os atributos ARIA/tabindex dos cards visíveis e esconde dos leitores
     * de tela os que estão apenas saindo (animação de recolher).
     *
     * @param {object[]} visiveis Nós visíveis após a mudança.
     */
    function atualizarAtributos(visiveis) {
      const ids = new Set(visiveis.map((n) => n.data.id));
      // Se o card focado sumiu (foi recolhido), o foco volta para a raiz.
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
          .classed('expansivel', temFilhos(n))
          .classed('atalho', Boolean(n.data.targetId));
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

    /**
     * Mede a altura REAL de cada card na largura definida pelo perfil.
     * Por quê: a altura depende do texto (um nome longo ocupa mais linhas), e o
     * algoritmo de layout precisa dela para não haver sobreposição. Escreve todas
     * as larguras antes de ler qualquer altura, para o navegador recalcular o
     * layout uma única vez (evita "layout thrashing").
     */
    function medir(nos, p) {
      nos.forEach((n) => {
        const el = elementos.get(n.data.id);
        el.style.width = `${larguraCard(n, p)}px`;
        el.style.height = '';
        el.__altura = null;
      });
      nos.forEach((n) => {
        // Math.ceil: altura inteira em px CSS. Altura fracionária deixa as bordas e o
        // texto do card fora da grade de pixels da tela, o que os faz parecer embaçados.
        alturas.set(n.data.id, Math.ceil(elementos.get(n.data.id).getBoundingClientRect().height - 0.01));
      });
    }

    // ---------- layout e animação ----------

    /**
     * Converte a hierarquia em árvore "só com o que o layout precisa" (id, tamanho,
     * filhos visíveis). Recolher um nó equivale a ele não ter filhos nesta árvore.
     */
    function arvoreLayout(n, p) {
      const id = n.data.id;
      return {
        id,
        w: larguraCard(n, p),
        h: alturas.get(id),
        children: expandidos.has(id) && temFilhos(n) ? n.children.map((c) => arvoreLayout(c, p)) : []
      };
    }

    /** Ancestral mais próximo que pertence ao conjunto `existe` (ou null). */
    function ancestralPresente(id, existe) {
      let n = porId.get(id).parent;
      while (n && !existe.has(n.data.id)) n = n.parent;
      return n ? n.data.id : null;
    }

    /**
     * Reduz o espaço de cada nível para garantir que, mesmo com todos os níveis
     * quebrados em linhas (cada um gasta um "gutter" de largura), ainda caiba
     * pelo menos um card por linha. Protege telas muito estreitas contra overflow.
     *
     * @param {Perfil} p Perfil bruto.
     * @returns {Perfil} Perfil ajustado (cópia).
     */
    function ajustarPerfil(p) {
      const niveis = Math.max(1, hierarquia.height);
      const gutter = Math.min(p.gutter, Math.max(GUTTER_MINIMO, Math.floor((p.maxWidth - RESERVA_CARDS_POR_LINHA) / niveis)));
      const cardWidth = Math.max(LARGURA_MINIMA_CARD, Math.min(p.cardWidth, p.maxWidth - gutter * niveis));
      return { ...p, gutter, cardWidth };
    }

    /**
     * Recalcula o layout após qualquer mudança (expandir, recolher, redimensionar).
     * É o único ponto de entrada do ciclo medir -> calcular -> animar.
     *
     * @param {object} [op]
     * @param {string} [op.ancora] Id do card que deve ficar parado na tela.
     * @param {boolean} [op.instantaneo] Pula a animação (redimensionamento, carga inicial).
     * @param {boolean} [op.remedir] Força nova medição de todos os cards (ex.: fontes carregaram).
     * @param {() => void} [op.depois] Chamado quando a animação termina.
     */
    function reorganizar(op) {
      const opts = op || {};
      const p = ajustarPerfil(perfil(palco.clientWidth));
      const visiveis = coletarVisiveis();
      const idsVisiveis = new Set(visiveis.map((n) => n.data.id));
      // Cards que estão saindo continuam no DOM até a animação terminar.
      const manter = new Set([...idsVisiveis, ...atual.keys()]);

      sincronizarDOM(manter);
      atualizarAtributos(visiveis);

      // Só remede tudo se a largura dos cards mudou; senão mede apenas os novos.
      const refazerTudo = opts.remedir || !perfilAtual || perfilAtual.cardWidth !== p.cardWidth;
      perfilAtual = p;
      medir(refazerTudo ? visiveis : visiveis.filter((n) => !alturas.has(n.data.id) || !atual.has(n.data.id)), p);

      // Calcula o posicionamento dos nós (algoritmo puro, testável em Node).
      const layout = Layout.compute(arvoreLayout(hierarquia, p), p);
      iniciarTransicao(layout, idsVisiveis, p, opts);
    }

    /**
     * Traduz o resultado do layout para "alvos" de animação por card. Os parâmetros
     * dos conectores ficam RELATIVOS ao pai (b0, bR, tx): assim, durante a animação,
     * a linha acompanha o pai mesmo enquanto ele se move.
     *
     * @param {object} layout Resultado de `Layout.compute`.
     * @returns {Map<string, object>} Valores finais de cada card.
     */
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

    /**
     * Anima da posição ATUAL até a posição calculada. Usa d3.timer (e não CSS
     * transition) porque os conectores SVG precisam ser recalculados a cada quadro
     * junto com os cards; CSS não anima o formato de um <path> derivado de dois elementos.
     *
     * @param {object} layout Resultado de `Layout.compute`.
     * @param {Set<string>} idsVisiveis Ids que ficarão visíveis ao final.
     * @param {Perfil} p Perfil ajustado em uso.
     * @param {object} opts Opções recebidas por `reorganizar`.
     */
    function iniciarTransicao(layout, idsVisiveis, p, opts) {
      if (temporizador) temporizador.stop();
      definirAnimando(false);
      // Se esta transição interrompe outra, o `depois` da interrompida NÃO pode se perder
      // (ex.: o foco da busca); ele roda ao fim desta. Sem isso, um redimensionamento ou o
      // fim do carregamento da fonte no meio da animação deixaria o usuário sem foco.
      if (opts.depois) aoConcluir.push(opts.depois);

      const alvos = valoresAlvo(layout);
      const existentes = new Set(atual.keys());
      const saindo = [];
      atual.forEach((e, id) => { if (!alvos.has(id)) saindo.push(id); });

      // Quem sai "se recolhe" para dentro do ancestral visível mais próximo e some;
      // quem entra nasce nesse mesmo ponto. Dá a sensação de abrir/fechar uma gaveta.
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
      // Sem animação: pedida pela chamada, pedida pelo sistema (acessibilidade) ou primeira pintura.
      const duracao = opts.instantaneo || menosMovimento.matches || !existentes.size ? 0 : DURACAO_MS;

      /** Um quadro da animação: interpola todos os valores e redesenha. */
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

        // Mantém o card clicado parado na tela enquanto o resto se reorganiza
        // (sem isso, abrir um card no meio da página faria o conteúdo "pular").
        if (ancora && atual.has(ancora)) {
          const y = atual.get(ancora).y;
          if (Math.abs(y - yAncora) > 0.5) {
            global.scrollBy(0, y - yAncora);
            yAncora = y;
          }
        }
      }

      /** Fim da animação: descarta quem saiu e fixa o estado final. */
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

    /**
     * Liga/desliga o estado "animando" (classe no palco + variável usada por `desenhar`).
     * Por quê: `will-change: transform` promove cada card a uma camada de GPU, e o
     * texto de camadas compostas é reamostrado (fica mais mole). Então a promoção
     * só vale durante o movimento; em repouso o texto é desenhado direto na tela, nítido.
     *
     * @param {boolean} ligado Se há transição em curso.
     */
    function definirAnimando(ligado) {
      animando = ligado;
      palco.classList.toggle('animando', ligado);
    }

    /**
     * Aplica as posições aos cards e redesenha os conectores. Chamada a cada quadro.
     * Só escreve no DOM o que mudou (ex.: altura), por desempenho.
     *
     * @param {Perfil} p Perfil em uso (raio dos cantos dos conectores).
     */
    function desenhar(p) {
      // O diagrama é centralizado quando é mais estreito que o palco.
      const larguraPalco = palco.clientWidth;
      const deslocamento = Math.max(0, (larguraPalco - caixaAtual.w) / 2);
      // Leitura de geometria ANTES de qualquer escrita no DOM (um único cálculo de layout).
      const caixaPalco = palco.getBoundingClientRect();
      const dpr = global.devicePixelRatio || 1;
      /**
       * Alinha uma coordenada (relativa ao palco) à grade de PIXELS FÍSICOS da tela.
       * Por quê: um `translate` fracionário faz o navegador reamostrar o card
       * inteiro, e o texto fica borrado. A origem do palco também pode ser
       * fracionária (alturas de cabeçalho, zoom 110/125/150%), por isso o
       * arredondamento considera a posição absoluta e depois volta ao relativo.
       */
      const alinhar = (v, origem) => Math.round((origem + v) * dpr) / dpr - origem;
      // Altura explícita: os cards são position:absolute e não "empurram" a página sozinhos.
      palco.style.height = `${Math.ceil(caixaAtual.h)}px`;

      const caminhos = new Map();
      svg.selectAll('path.aresta').each(function (n) { caminhos.set(n.data.id, this); });

      atual.forEach((e, id) => {
        const el = elementos.get(id);
        if (!el) return;
        // transform (e não top/left) para animar na GPU, sem recalcular o layout da página.
        // Durante a animação o movimento suave vale mais que a nitidez; no repouso
        // (`animando` ausente) a posição é alinhada à grade de pixels.
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
          // Desenha os conectores com os mesmos números dos cards (nunca se descolam).
          const pts = Layout.pontosAresta(
            px, base, deslocamento + e.x + e.w / 2, e.y, base + e.b0, base + e.bR, px + e.tx
          );
          caminho.setAttribute('d', Layout.caminhoArredondado(pts, p.radius || 10));
          caminho.style.opacity = e.op;
        }
      });
    }

    // ---------- ações do usuário ----------

    /** Escreve na região aria-live (leitores de tela falam o texto sem mover o foco). */
    function anunciar(texto) {
      if (anuncio) anuncio.textContent = texto;
    }

    /**
     * Define qual card recebe o foco do teclado (roving tabindex: só um card fica
     * na ordem de Tab, as setas movem entre os demais).
     */
    function definirFoco(id, mover) {
      focoId = id;
      elementos.forEach((el, k) => el.setAttribute('tabindex', k === id ? '0' : '-1'));
      if (mover) elementos.get(id).focus();
    }

    /**
     * Regra de acordeão: ao abrir um filho direto da raiz, fecha os irmãos (e toda a
     * subárvore deles). Existe só no mobile, onde três ramos abertos juntos viram
     * uma página enorme; no desktop os ramos ficam lado a lado e não há esse problema.
     *
     * @param {object} n Nó que acabou de ser aberto.
     * @returns {boolean} true se algum irmão estava aberto e foi fechado.
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

    /** Abre ou fecha um card (clique, toque, Enter, Espaço ou seta). */
    function alternar(id) {
      const n = porId.get(id);
      if (!temFilhos(n)) return;
      const abrir = !expandidos.has(id);
      let fechouIrmaos = false;

      if (abrir) {
        expandidos.add(id);
        fechouIrmaos = aplicarAcordeao(n);
      } else {
        n.each((d) => expandidos.delete(d.data.id)); // recolher também fecha os descendentes
        if (n.data.id === hierarquia.data.id) expandidos.add(id); // a raiz nunca fecha
      }
      salvarEstado();
      reorganizar({ ancora: id });
      anunciar(`${n.data.nome} ${abrir ? 'expandido' : 'recolhido'}, ${n.children.length} subunidades`
        + (fechouIrmaos ? '. As outras seções foram recolhidas' : ''));
    }

    /**
     * Leva o usuário a um card: abre todos os ancestrais, foca, rola até ele e o
     * faz pulsar. É o ponto de chegada comum da busca, da legenda e dos atalhos
     * (`targetId`). NÃO aplica o acordeão: quem navega diretamente quer ver o destino,
     * e fechar ramos abertos o surpreenderia.
     *
     * @param {string} id Id do card de destino.
     */
    function irPara(id) {
      const alvo = porId.get(id);
      // ancestors() inclui o próprio nó na posição 0; slice(1) mantém só os ancestrais.
      alvo.ancestors().slice(1).forEach((a) => expandidos.add(a.data.id));
      salvarEstado();
      reorganizar({
        depois: () => {
          const el = elementos.get(id);
          definirFoco(id, false);
          el.focus({ preventScroll: true }); // a rolagem é feita logo abaixo, com a suavidade certa
          el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: menosMovimento.matches ? 'auto' : 'smooth' });
          // Reinicia a animação do pulso (remove, força reflow, adiciona).
          el.classList.remove('pulso');
          void el.offsetWidth;
          el.classList.add('pulso');
        }
      });
      anunciar(`Navegando para ${alvo.data.nome}`);
    }

    /** Ação do card: atalho navega até o destino; os demais alternam aberto/fechado. */
    function ativar(id) {
      const n = porId.get(id);
      if (n.data.targetId && porId.has(n.data.targetId)) irPara(n.data.targetId);
      else alternar(id);
    }

    function expandirTudo() {
      hierarquia.each((n) => { if (temFilhos(n)) expandidos.add(n.data.id); });
      salvarEstado();
      reorganizar({ ancora: hierarquia.data.id });
      anunciar(`Todos os ${porId.size} cards estão visíveis`);
    }

    /**
     * Abre UM nível por vez: o mais raso que ainda tenha cards fechados entre os
     * visíveis. Útil no mobile, onde "Expandir tudo" geraria uma página gigantesca.
     * Ignora o acordeão (é uma ação explícita de abrir mais).
     */
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

    function recolherTudo() {
      expandidos.clear();
      expandidos.add(hierarquia.data.id);
      definirFoco(hierarquia.data.id, false);
      salvarEstado();
      reorganizar({ ancora: hierarquia.data.id });
      anunciar('Organograma recolhido');
    }

    /**
     * Realça a cadeia de comando (do card até a raiz) ao passar o mouse/focar.
     * Ajuda a responder "a quem este setor se subordina?" num diagrama grande.
     *
     * @param {string | null} id Card em destaque, ou null para limpar.
     */
    function destacar(id) {
      const cadeia = id ? new Set(porId.get(id).ancestors().map((a) => a.data.id)) : null;
      svg.selectAll('path.aresta')
        .classed('destaque', (n) => Boolean(cadeia && cadeia.has(n.data.id)))
        .filter('.destaque').raise();
      d3.select(palco).selectAll('.card')
        .classed('ancestral', (n) => Boolean(cadeia && cadeia.has(n.data.id) && n.data.id !== id));
    }

    /** Id do card que originou um evento (ignora cards em saída). */
    const idDoEvento = (e) => {
      const el = e.target.closest && e.target.closest('.card');
      return el && !el.classList.contains('saindo') ? el.dataset.id : null;
    };

    // Um único listener no palco (delegação de eventos) atende todos os cards,
    // inclusive os criados depois; é mais leve que um listener por card.
    palco.addEventListener('click', (e) => {
      const id = idDoEvento(e);
      if (!id) return;
      definirFoco(id, false);
      elementos.get(id).focus({ preventScroll: true });
      ativar(id);
    });
    palco.addEventListener('pointerover', (e) => destacar(idDoEvento(e)));
    palco.addEventListener('pointerleave', () => destacar(document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.id : null));
    palco.addEventListener('focusin', (e) => destacar(idDoEvento(e)));
    palco.addEventListener('focusout', () => destacar(null));

    /**
     * Teclado no padrão WAI-ARIA "tree":
     * ↑/↓ percorrem os cards visíveis; → abre (ou entra no 1º filho); ← fecha
     * (ou sobe ao pai); Enter/Espaço ativam; Home/End vão ao primeiro/último.
     */
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
        case ' ': ativar(id); break;
        default: return; // outras teclas seguem o comportamento normal do navegador
      }
      e.preventDefault(); // evita rolar a página com as setas/Espaço
      if (destino) definirFoco(destino.data.id, true);
    });

    // ---------- barra de ações e legenda ----------

    /** Ações da barra, ligadas por atributo (`data-acao`): o HTML decide quais botões existem. */
    const acoesDaBarra = {
      'expandir-nivel': expandirProximoNivel,
      'expandir-tudo': expandirTudo,
      'recolher-tudo': recolherTudo
    };
    document.querySelectorAll('[data-acao]').forEach((botao) => {
      const acao = acoesDaBarra[botao.dataset.acao];
      if (acao) botao.addEventListener('click', acao);
    });

    /**
     * Legenda: um botão por tipo usado nos dados; clicar leva ao primeiro card daquele
     * tipo (na ordem de leitura). Gerada a partir dos dados para nunca ficar
     * desatualizada quando um tipo novo é criado.
     */
    const legenda = document.getElementById('legenda');
    if (legenda) {
      const primeiroPorTipo = new Map();
      hierarquia.eachBefore((n) => { // eachBefore = pré-order (ordem de leitura)
        if (!primeiroPorTipo.has(n.data.tipo)) primeiroPorTipo.set(n.data.tipo, n.data.id);
      });

      Object.keys(ROTULOS_TIPO).filter((t) => primeiroPorTipo.has(t)).forEach((tipo) => {
        const botao = d3.select(legenda).append('li').append('button')
          .attr('type', 'button')
          .attr('class', 'legenda-item')
          .attr('aria-label', `Ir para primeiro nó do tipo ${ROTULOS_TIPO[tipo]}`)
          .on('click', () => irPara(primeiroPorTipo.get(tipo)));
        botao.append('span').attr('class', `amostra card-${tipo}`).attr('aria-hidden', 'true');
        botao.append('span').text(ROTULOS_TIPO[tipo]);
      });
    }

    // Busca (módulo opcional): se o script não foi carregado, a página funciona sem ela.
    if (global.OrganogramaBusca) global.OrganogramaBusca.montar({ porId, irPara, anunciar });

    // ---------- redimensionamento ----------

    let larguraAnterior = palco.clientWidth;
    let agendado = false;

    /**
     * Refaz o layout quando a LARGURA do palco muda. Variações só de altura são
     * ignoradas (o próprio diagrama muda a altura e causaria um laço). O
     * requestAnimationFrame agrupa várias notificações do mesmo quadro em uma.
     */
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

    // Quando as fontes terminam de carregar, o texto muda de largura: remede os cards.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => reorganizar({ instantaneo: true, remedir: true }));
      // Fontes carregadas depois do `ready` (ex.: arquivos de fonts/ lentos) também mudam a largura do texto.
      if (document.fonts.addEventListener) {
        document.fonts.addEventListener('loadingdone', () => reorganizar({ instantaneo: true, remedir: true }));
      }
    }

    reorganizar({ instantaneo: true });

    return { alternar, irPara, expandirTudo, expandirProximoNivel, recolherTudo, expandidos, porId };
  }

  global.Organograma = { montar, validarArvore, ROTULOS_TIPO };
}(window));
