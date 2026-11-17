/*
 * TAMANHOS POR TELA (celular x desktop)
 *
 * EDITE AQUI para mudar largura dos cards, espaços e distâncias.
 *   - perfilCelular() ... telas até 640px (acordeão: abrir um ramo fecha os outros)
 *   - perfilDesktop() ... telas maiores
 * O limite de 640px é o mesmo do CSS (seção 6 de css/organograma.css).
 * Ao cruzar o limite, o organograma se refaz sozinho.
 * Este arquivo é o último a carregar: no fim ele inicia o organograma.
 */
(function (global) {
  'use strict';

  /** Media query do celular; mantenha igual à do CSS. */
  const CONSULTA_CELULAR = '(max-width: 640px)';

  // ===== CELULAR =====

  /** Margem total (px) reservada nas laterais da tela. */
  const GUTTER = 16;

  /** Espaço (px) entre cards irmãos. Menor que no desktop para aproveitar a largura. */
  const GAP_X = 12;

  /** Faixa de largura (px) dos cards: abaixo do mínimo o texto fica ilegível; acima do máximo desperdiça tela. */
  const LARGURA_MINIMA = 132;
  const LARGURA_MAXIMA = 168;

  /**
   * @param {number} largura Largura (px) disponível para o diagrama.
   * @returns {object} Perfil (ver `Perfil` em organograma-core.js).
   */
  function perfilCelular(largura) {
    // Quantas colunas de cards cabem; nunca menos de 2, para que um nível com
    // vários filhos não vire uma coluna única (o que pareceria uma lista).
    const colunas = Math.max(2, Math.floor((largura - GUTTER + GAP_X) / (LARGURA_MINIMA + GAP_X)));
    // Divide a largura útil igualmente entre as colunas, para os cards preencherem a linha.
    const cardWidth = Math.floor((largura - GUTTER - GAP_X * (colunas - 1)) / colunas);

    return {
      maxWidth: largura,
      cardWidth: Math.max(120, Math.min(LARGURA_MAXIMA, cardWidth)),
      gapX: GAP_X,
      groupGap: 12,           // separação extra entre grupos, menor que no desktop
      gapY: 44,               // distância vertical entre níveis (a altura é o recurso barato no celular)
      gutter: GUTTER,         // corredor do tronco que liga as linhas de filhos
      radius: 8,              // cantos dos conectores um pouco mais fechados
      acordeaoRaizes: true    // abrir um filho direto da raiz fecha os outros (evita páginas enormes)
    };
  }

  // ===== DESKTOP =====

  /**
   * @param {number} largura Largura (px) disponível para o diagrama.
   * @returns {object} Perfil (ver `Perfil` em organograma-core.js).
   */
  function perfilDesktop(largura) {
    // Janela um pouco acima do limite do celular mas com palco estreito (as margens
    // laterais comem espaço): usa medidas compactas para não haver rolagem horizontal.
    const estreito = largura < 640;
    return {
      // Limite de 1760px: em monitores muito largos, linhas longas demais dificultam
      // acompanhar os conectores de um card até seus filhos.
      maxWidth: Math.min(largura, 1760),
      cardWidth: estreito ? 150 : 200,
      gapX: estreito ? 12 : 24,
      groupGap: estreito ? 12 : 24,
      gapY: estreito ? 48 : 64,
      gutter: estreito ? 16 : 20,
      radius: 10
      // Sem `acordeaoRaizes`: no desktop os ramos ficam lado a lado e não há problema
      // em manter vários abertos ao mesmo tempo.
    };
  }

  /** Escolhe o perfil pela janela (largura do quadro, quando incorporado). */
  function perfil(largura) {
    return global.matchMedia(CONSULTA_CELULAR).matches ? perfilCelular(largura) : perfilDesktop(largura);
  }

  global.OrganogramaPerfil = { perfil, perfilCelular, perfilDesktop, CONSULTA_CELULAR };
  global.Organograma.montar({ perfil });
}(window));
