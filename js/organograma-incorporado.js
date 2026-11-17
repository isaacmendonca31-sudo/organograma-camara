/*
 * MODO INCORPORADO (página dentro de um <iframe> do site)
 *
 * Carrega no <head> para a página já nascer no modo certo.
 *
 * Liga sozinho dentro de um <iframe>. Para testar fora dele, use ?incorporado na URL;
 * ?incorporado=0 desliga.
 *
 * O que muda: o topo azul e o "Voltar ao site" ficam escondidos (o site já tem os seus)
 * e a barra deixa de ser fixa. As regras estão na seção 6 de css/organograma.css.
 *
 * Altura: o <iframe> não cresce sozinho, então esta página avisa o site da sua altura:
 *   window.parent.postMessage({ tipo: 'organograma-cmg:altura', altura: 1234 }, '*')
 * O site ajusta o quadro com o trecho de INCORPORACAO.md (exemplo em exemplo-no-site.html).
 * Sem esse trecho nada quebra: o organograma só rola dentro do quadro.
 */
(function (global) {
  'use strict';

  const consulta = global.location.search;
  const desligado = /[?&]incorporado=0(&|$)/.test(consulta);
  const forcado = /[?&]incorporado(=|&|$)/.test(consulta);

  let emQuadro;
  try {
    emQuadro = global.self !== global.top;
  } catch (erro) {
    emQuadro = true; // acesso ao topo bloqueado entre origens = estamos num quadro
  }

  if (desligado || !(emQuadro || forcado)) return;

  document.documentElement.classList.add('incorporado');

  // A mensagem só faz sentido dentro de um quadro (fora dele, window.parent é a própria janela).
  if (!emQuadro) return;

  let agendado = false;

  function avisarAltura() {
    agendado = false;
    // body.offsetHeight (e não a altura da janela): o quadro precisa poder encolher.
    global.parent.postMessage({ tipo: 'organograma-cmg:altura', altura: document.body.offsetHeight }, '*');
  }

  /** Agrupa várias mudanças do mesmo quadro de animação numa única mensagem. */
  function agendar() {
    if (agendado) return;
    agendado = true;
    global.requestAnimationFrame(avisarAltura);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if ('ResizeObserver' in global) new global.ResizeObserver(agendar).observe(document.body);
    else global.addEventListener('resize', agendar);
    agendar();
  });
}(window));
