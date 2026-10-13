/**
 * @file Busca de unidades do organograma.
 *
 * Responsabilidade ÚNICA deste módulo: receber o texto digitado, encontrar os
 * nós correspondentes e entregar o escolhido ao núcleo (`irPara`). Ele não
 * sabe nada de layout, D3 ou animação - por isso pode ser alterado ou removido
 * sem tocar no resto do projeto.
 *
 * Acoplamento com o núcleo (de propósito, só três coisas):
 *   - `porId`    Map<id, nó d3.hierarchy> com todos os nós da árvore;
 *   - `irPara`   expande os ancestrais, foca, rola e pulsa o card;
 *   - `anunciar` escreve na região aria-live para leitores de tela.
 *
 * Padrão de acessibilidade: "combobox com listbox" (WAI-ARIA 1.2). O foco
 * fica SEMPRE no <input>; a opção "ativa" é indicada por
 * `aria-activedescendant`, o que permite ao usuário continuar digitando
 * enquanto navega pelas sugestões com as setas.
 */
(function (global) {
  'use strict';

  /** Máximo de sugestões exibidas: mais que isso vira rolagem sem ganho de uso. */
  const MAX_RESULTADOS = 12;

  /** Prefixo dos ids das opções; precisa ser único para `aria-activedescendant`. */
  const PREFIXO_ID_OPCAO = 'busca-opcao-';

  /** Pontuação de relevância (quanto maior, mais acima na lista). */
  const PONTOS = Object.freeze({
    SIGLA_EXATA: 100,
    SIGLA_COMECA: 60,
    NOME_COMECA: 50,
    PALAVRA_COMECA: 30,
    CONTEM: 10
  });

  /**
   * Remove acentos e padroniza caixa, para que "comissoes" encontre "Comissões".
   *
   * Por quê NFD: separa a letra do acento (ç -> c + ̧ , ã -> a + ̃ ); a regex
   * descarta os acentos (bloco Unicode "Combining Diacritical Marks").
   *
   * @param {string} texto Texto original.
   * @returns {string} Texto sem acentos, em minúsculas e sem espaços nas pontas.
   */
  function normalizar(texto) {
    return String(texto)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Monta o índice de busca UMA vez. Normalizar a cada tecla seria trabalho
   * repetido: o texto dos nós não muda depois que a página carrega.
   *
   * @param {Map<string, object>} porId Nós por id.
   * @param {Record<string, string>} rotulosTipo Rótulo exibido de cada tipo.
   * @returns {Array<object>} Itens prontos para filtrar.
   */
  function construirIndice(porId, rotulosTipo) {
    const indice = [];
    porId.forEach((no, id) => {
      const dados = no.data;
      const tipo = rotulosTipo[dados.tipo] || dados.tipo;
      indice.push({
        id,
        nome: dados.nome,
        sigla: dados.sigla || '',
        tipo,
        // Se o nó é um atalho, selecioná-lo leva ao nó de destino.
        destino: dados.targetId && porId.has(dados.targetId) ? dados.targetId : id,
        nomeNorm: normalizar(dados.nome),
        siglaNorm: normalizar(dados.sigla || ''),
        // Texto único pesquisável: nome + sigla + tipo (os três campos pedidos).
        textoNorm: normalizar(`${dados.nome} ${dados.sigla || ''} ${tipo}`)
      });
    });
    return indice;
  }

  /**
   * Pontua um item para uma consulta já separada em termos.
   * Todos os termos precisam aparecer (E lógico); caso contrário o item é descartado.
   *
   * @param {object} item Item do índice.
   * @param {string[]} termos Termos normalizados da consulta.
   * @returns {number} 0 se não combina; senão, quanto maior, mais relevante.
   */
  function pontuar(item, termos) {
    let total = 0;
    for (const termo of termos) {
      if (!item.textoNorm.includes(termo)) return 0;

      if (item.siglaNorm === termo) total += PONTOS.SIGLA_EXATA;
      else if (item.siglaNorm.startsWith(termo)) total += PONTOS.SIGLA_COMECA;
      else if (item.nomeNorm.startsWith(termo)) total += PONTOS.NOME_COMECA;
      else if (item.nomeNorm.includes(` ${termo}`)) total += PONTOS.PALAVRA_COMECA;
      else total += PONTOS.CONTEM;
    }
    return total;
  }

  /**
   * Busca os itens que combinam com o texto digitado.
   *
   * @param {Array<object>} indice Índice de `construirIndice`.
   * @param {string} consulta Texto digitado pelo usuário.
   * @returns {{itens: Array<object>, total: number}} Até MAX_RESULTADOS itens
   *          ordenados por relevância, e o total de itens que combinaram.
   */
  function buscar(indice, consulta) {
    const termos = normalizar(consulta).split(/\s+/).filter(Boolean);
    if (termos.length === 0) return { itens: [], total: 0 };

    const pontuados = [];
    for (const item of indice) {
      const pontos = pontuar(item, termos);
      if (pontos > 0) pontuados.push({ item, pontos });
    }
    // Desempate por ordem original (sort é estável): mantém a ordem do organograma.
    pontuados.sort((a, b) => b.pontos - a.pontos);

    return {
      itens: pontuados.slice(0, MAX_RESULTADOS).map((p) => p.item),
      total: pontuados.length
    };
  }

  /**
   * Frase para o leitor de tela com a quantidade de resultados.
   *
   * @param {number} total Quantidade de itens que combinaram.
   * @returns {string} Mensagem em português, com singular/plural correto.
   */
  function frasePlural(total) {
    if (total === 0) return 'Nenhum resultado';
    return total === 1 ? '1 resultado' : `${total} resultados`;
  }

  /**
   * Liga a busca aos elementos da página.
   *
   * Elementos exigidos no HTML (ids): `busca-campo` (input) e `busca-lista` (ul).
   * Se não existirem, a função não faz nada: a página continua funcionando sem busca.
   *
   * @param {object} opcoes
   * @param {Map<string, object>} opcoes.porId Nós por id.
   * @param {(id: string) => void} opcoes.irPara Navega até o nó.
   * @param {(texto: string) => void} opcoes.anunciar Escreve na região aria-live.
   * @returns {{destruir: () => void} | null} Controle para remover os listeners
   *          (útil em testes e em páginas que remontam o componente).
   */
  function montar({ porId, irPara, anunciar }) {
    const campo = document.getElementById('busca-campo');
    const lista = document.getElementById('busca-lista');
    if (!campo || !lista) return null;

    const rotulosTipo = (global.Organograma && global.Organograma.ROTULOS_TIPO) || {};
    const indice = construirIndice(porId, rotulosTipo);

    /** Itens exibidos agora e posição da opção ativa (-1 = nenhuma). */
    let resultados = [];
    let ativo = -1;

    const aberta = () => !lista.hidden;

    /** Marca a opção ativa (visual + ARIA) e a mantém visível na rolagem. */
    function definirAtivo(posicao) {
      ativo = posicao;
      Array.from(lista.children).forEach((opcao, i) => {
        const selecionada = i === posicao;
        opcao.setAttribute('aria-selected', String(selecionada));
        opcao.classList.toggle('ativa', selecionada);
      });

      if (posicao >= 0) {
        campo.setAttribute('aria-activedescendant', PREFIXO_ID_OPCAO + posicao);
        lista.children[posicao].scrollIntoView({ block: 'nearest' });
      } else {
        campo.removeAttribute('aria-activedescendant');
      }
    }

    /** Fecha a lista e devolve o estado ARIA ao padrão. */
    function fechar() {
      lista.hidden = true;
      campo.setAttribute('aria-expanded', 'false');
      definirAtivo(-1);
    }

    function abrir() {
      lista.hidden = false;
      campo.setAttribute('aria-expanded', 'true');
    }

    /**
     * Cria uma <li> de resultado. Usa textContent (nunca innerHTML): os nomes
     * vêm dos dados e não devem ser interpretados como HTML.
     */
    function criarOpcao(item, posicao) {
      const li = document.createElement('li');
      li.id = PREFIXO_ID_OPCAO + posicao;
      li.className = 'busca-opcao';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');

      const nome = document.createElement('span');
      nome.className = 'busca-opcao-nome';
      nome.textContent = item.sigla ? `${item.nome} (${item.sigla})` : item.nome;

      const tipo = document.createElement('span');
      tipo.className = 'busca-opcao-tipo';
      tipo.textContent = item.tipo;

      li.append(nome, tipo);
      li.addEventListener('click', () => escolher(posicao));
      return li;
    }

    /** Redesenha a lista a cada mudança do texto. */
    function atualizar() {
      const { itens, total } = buscar(indice, campo.value);
      resultados = itens;
      lista.replaceChildren(...itens.map(criarOpcao));

      if (!campo.value.trim()) {
        fechar();
        return;
      }

      if (itens.length === 0) {
        // Mensagem visível e não selecionável; o leitor de tela recebe o anúncio abaixo.
        const vazio = document.createElement('li');
        vazio.className = 'busca-vazio';
        vazio.setAttribute('role', 'presentation');
        vazio.textContent = 'Nenhuma unidade encontrada';
        lista.append(vazio);
      }

      abrir();
      definirAtivo(-1);
      anunciar(total > itens.length
        ? `${frasePlural(total)}, mostrando os ${itens.length} primeiros`
        : frasePlural(total));
    }

    /** Confirma uma sugestão: fecha a lista e delega a navegação ao núcleo. */
    function escolher(posicao) {
      const item = resultados[posicao];
      if (!item) return;
      fechar();
      irPara(item.destino);
    }

    /** Teclado do campo: setas, Enter, Esc e Tab (padrão combobox ARIA). */
    function aoTeclar(evento) {
      switch (evento.key) {
        case 'ArrowDown':
          evento.preventDefault();
          if (!aberta() && campo.value.trim()) atualizar();
          if (resultados.length) definirAtivo((ativo + 1) % resultados.length);
          break;
        case 'ArrowUp':
          evento.preventDefault();
          if (resultados.length) definirAtivo(ativo <= 0 ? resultados.length - 1 : ativo - 1);
          break;
        case 'Enter':
          if (aberta() && resultados.length) {
            evento.preventDefault();
            // Sem opção ativa, Enter escolhe a primeira (a mais relevante).
            escolher(ativo >= 0 ? ativo : 0);
          }
          break;
        case 'Escape':
          // Primeiro Esc fecha a lista; com a lista já fechada, limpa o texto.
          if (aberta()) fechar();
          else campo.value = '';
          break;
        case 'Tab':
          // Tab deve sair do campo normalmente; só garantimos a lista fechada.
          fechar();
          break;
        default:
      }
    }

    /** Clique fora do componente fecha a lista. */
    function aoClicarFora(evento) {
      if (!campo.contains(evento.target) && !lista.contains(evento.target)) fechar();
    }

    // Atributos ARIA fixos do padrão combobox.
    campo.setAttribute('role', 'combobox');
    campo.setAttribute('aria-autocomplete', 'list');
    campo.setAttribute('aria-controls', lista.id);
    campo.setAttribute('aria-expanded', 'false');
    lista.setAttribute('role', 'listbox');
    lista.hidden = true;

    campo.addEventListener('input', atualizar);
    campo.addEventListener('keydown', aoTeclar);
    // Reabre a lista ao voltar o foco para um campo que ainda tem texto.
    campo.addEventListener('focus', () => { if (campo.value.trim() && !aberta()) atualizar(); });
    document.addEventListener('pointerdown', aoClicarFora);

    return {
      destruir() {
        campo.removeEventListener('input', atualizar);
        campo.removeEventListener('keydown', aoTeclar);
        document.removeEventListener('pointerdown', aoClicarFora);
      }
    };
  }

  // `normalizar` e `buscar` ficam expostos para permitir testes sem DOM.
  global.OrganogramaBusca = { montar, normalizar, buscar, construirIndice };
}(window));
