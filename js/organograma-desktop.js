/*
 * Perfil desktop: o organograma ocupa a largura da janela (até um limite) e cresce
 * para os lados; só quando os irmãos não cabem numa linha é que ele quebra para baixo.
 *
 * Este arquivo só contém NÚMEROS (o "perfil"). Para deixar o desktop mais
 * espaçado ou compacto, altere os valores abaixo - o algoritmo não muda.
 */
(function () {
  'use strict';

  function perfilDesktop(largura) {
    // Se esta página for aberta numa tela estreita, usa medidas compactas
    // (garante que não haja rolagem horizontal mesmo fora do uso previsto).
    const estreito = largura < 640;
    return {
      // Limite de 1760px: em monitores muito largos, linhas longas demais dificultam
      // acompanhar os conectores de um card até seus filhos.
      maxWidth: Math.min(largura, 1760), // largura disponível para o diagrama
      cardWidth: estreito ? 150 : 200,   // largura dos cards
      gapX: estreito ? 12 : 24,          // espaço entre cards irmãos
      groupGap: estreito ? 12 : 24,      // espaço extra entre grupos (irmãos com filhos)
      gapY: estreito ? 48 : 64,          // distância vertical entre níveis
      gutter: estreito ? 16 : 20,        // corredor do tronco quando os filhos quebram em linhas
      radius: 10                         // arredondamento dos cantos dos conectores
      // Sem `acordeaoRaizes`: no desktop os ramos ficam lado a lado e não há problema
      // em manter vários abertos ao mesmo tempo.
    };
  }

  window.Organograma.montar({ perfil: perfilDesktop });
}());
