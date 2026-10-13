/**
 * @file Perfil mobile.
 *
 * Usa o MESMO algoritmo do desktop; só o orçamento de largura muda. Como o orçamento
 * é estreito, os irmãos que não cabem lado a lado quebram para baixo: o diagrama
 * cresce na vertical, mantém a hierarquia e as linhas de conexão, e nunca precisa
 * de rolagem horizontal.
 */
(function () {
  'use strict';

  /** Margem total (px) reservada nas laterais da tela. */
  const GUTTER = 16;

  /** Espaço (px) entre cards irmãos. Menor que no desktop para aproveitar a largura. */
  const GAP_X = 12;

  /** Faixa de largura (px) dos cards: abaixo do mínimo o texto fica ilegível; acima do máximo desperdiça tela. */
  const LARGURA_MINIMA = 132;
  const LARGURA_MAXIMA = 168;

  /**
   * Calcula o perfil para a largura atual do palco.
   *
   * @param {number} largura Largura (px) disponível para o diagrama.
   * @returns {object} Perfil (ver `Perfil` em organograma-core.js).
   */
  function perfilMobile(largura) {
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

  window.Organograma.montar({ perfil: perfilMobile });
}());
