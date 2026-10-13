"""Testes de navegador (Chromium headless).

Uso:  python3 tests/browser_test.py [--shots]

Mede no DOM REAL (e não em simulação): sobreposição de cards, conectores que
atravessam cards, rolagem horizontal, cards fora do palco e texto cortado, em
várias larguras e estados. Também exercita os recursos de interação: busca,
"Expandir próximo nível", legenda clicável, acordeão (mobile), validação dos
dados, redirecionador (index.html), teclado e movimento reduzido.

Regra transversal: nenhum cenário pode emitir `console.error` (exceto os de
validação, que PROVOCAM o erro de propósito e conferem que ele aparece).
"""
import os
import shutil
import sys
import tempfile

from playwright.sync_api import sync_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = {
    'desktop': 'file://' + os.path.join(RAIZ, 'organograma-desktop.html'),
    'mobile': 'file://' + os.path.join(RAIZ, 'organograma-mobile.html'),
    'index': 'file://' + os.path.join(RAIZ, 'index.html'),
}
SHOTS = '--shots' in sys.argv
PASTA_SHOTS = os.path.join(RAIZ, 'tests', 'screens')
if SHOTS:
    os.makedirs(PASTA_SHOTS, exist_ok=True)

# Script executado DENTRO da página: coleta as métricas de layout de uma vez
# (uma única ida ao navegador por verificação, bem mais rápido que várias).
CHECAR = """() => {
  const palco = document.getElementById('organograma');
  const pr = palco.getBoundingClientRect();
  const cards = [...palco.querySelectorAll('.card:not(.saindo)')];
  const R = cards.map(c => { const r = c.getBoundingClientRect(); return {id: c.dataset.id, x: r.left, y: r.top, w: r.width, h: r.height}; });
  const out = {cards: R.length, sobrepostos: [], foraDoPalco: [], cortados: [], conectores: [], rolagemH: false, linhasNivel: {}};
  // Dois cards se sobrepõem se seus retângulos (com folga de 4px) se cruzam.
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i], b = R[j];
    if (a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4) out.sobrepostos.push([a.id, b.id]);
  }
  R.forEach(r => { if (r.x < pr.left - 0.5 || r.x + r.w > pr.right + 0.5) out.foraDoPalco.push(r.id); });
  // Texto cortado: o conteúdo é maior que a caixa do card.
  cards.forEach(c => { if (c.scrollHeight > c.clientHeight + 1) out.cortados.push(c.dataset.id); });
  const doc = document.documentElement;
  out.rolagemH = doc.scrollWidth > doc.clientWidth + 0.5;
  // Percorre cada conector ponto a ponto (de 3 em 3px) e verifica se entra num card.
  document.querySelectorAll('#organograma path.aresta').forEach(p => {
    const len = p.getTotalLength();
    for (let s = 0; s <= len; s += 3) {
      const pt = p.getPointAtLength(s);
      const x = pt.x + pr.left, y = pt.y + pr.top;
      const hit = R.find(r => x > r.x + 1 && x < r.x + r.w - 1 && y > r.y + 1 && y < r.y + r.h - 1);
      if (hit) { out.conectores.push(hit.id); break; }
    }
  });
  const ys = new Set(R.map(r => Math.round(r.y)));
  out.linhasDistintas = ys.size;
  out.largura = Math.round(pr.width);
  out.altura = Math.round(pr.height);
  return out;
}"""

# Nome do card que está com o foco (vazio se o foco não está num card).
NOME_FOCADO = """() => {
  const a = document.activeElement;
  const n = a && a.querySelector ? a.querySelector('.card-nome') : null;
  return n ? n.textContent : '';
}"""

falhas = []
total = 0


def registrar(nome, ok, detalhe=''):
    """Conta uma verificação e imprime o resultado."""
    global total
    total += 1
    if ok:
        print(f'  ok    {nome}')
    else:
        falhas.append((nome, detalhe))
        print(f'  FALHA {nome} {detalhe}')


def verificar(nome, resultado, esperado_cards=None):
    """Confere as métricas de layout de CHECAR (e, opcionalmente, a quantidade de cards)."""
    global total
    total += 1
    problemas = []
    if resultado['sobrepostos']:
        problemas.append(f"sobreposição {resultado['sobrepostos'][:3]}")
    if resultado['conectores']:
        problemas.append(f"conector atravessa card {sorted(set(resultado['conectores']))[:3]}")
    if resultado['rolagemH']:
        problemas.append('rolagem horizontal')
    if resultado['foraDoPalco']:
        problemas.append(f"card fora do palco {resultado['foraDoPalco'][:3]}")
    if resultado['cortados']:
        problemas.append(f"texto cortado {resultado['cortados'][:3]}")
    if esperado_cards is not None and resultado['cards'] != esperado_cards:
        problemas.append(f"esperava {esperado_cards} cards, há {resultado['cards']}")
    if problemas:
        falhas.append((nome, problemas))
        print('  FALHA', nome, problemas)
    else:
        print(f"  ok    {nome} ({resultado['cards']} cards, {resultado['largura']}x{resultado['altura']}px)")


def card(page, nome):
    """Localiza o card visível cujo nome contém `nome`."""
    return page.locator('#organograma .card:not(.saindo)', has=page.locator('.card-nome', has_text=nome)).first


def clicar(page, nome):
    """Clica no card e espera a animação (380ms) terminar."""
    c = card(page, nome)
    c.scroll_into_view_if_needed()
    c.click()
    page.wait_for_timeout(650)


def shot(page, nome, completo=False):
    """Salva uma captura de tela somente quando o script recebe `--shots`."""
    if SHOTS:
        page.screenshot(path=os.path.join(PASTA_SHOTS, nome + '.png'), full_page=completo)


def nova_pagina(browser, modo, largura, altura, url=None, **opcoes_contexto):
    """Abre um contexto NOVO (sessionStorage vazio) e devolve (contexto, página, erros_de_console).

    Cada cenário usa um contexto próprio para que o estado salvo (cards abertos)
    de um não vaze para o seguinte."""
    ctx = browser.new_context(viewport={'width': largura, 'height': altura}, device_scale_factor=1,
                              has_touch=(modo == 'mobile'), is_mobile=(modo == 'mobile'), **opcoes_contexto)
    page = ctx.new_page()
    erros = []
    page.on('console', lambda m: erros.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: erros.append(str(e)))
    page.goto(url or URL[modo])
    return ctx, page, erros


def sem_erros(nome, erros):
    """Transforma erros JavaScript do navegador em uma verificação visível no relatório."""
    registrar(f'{nome}: zero console.error', not erros, erros[:3])


def aguardar_organograma(page):
    """Espera a primeira renderização e a curta estabilização inicial do layout."""
    page.wait_for_selector('#organograma .card')
    page.wait_for_timeout(300)


def sugestoes(page):
    """Textos das opções exibidas na lista da busca."""
    return page.eval_on_selector_all(
        '#busca-lista [role=option]',
        'els => els.map(e => e.querySelector(".busca-opcao-nome").textContent)')


# ---------------------------------------------------------------------------
# Cenário geral: layout, expandir/recolher, atalho, teclado, redimensionamento
# ---------------------------------------------------------------------------

def cenario(browser, modo, largura, altura, redimensionar_para=None):
    print(f"\n[{modo} {largura}x{altura}]")
    ctx, page, erros = nova_pagina(browser, modo, largura, altura)
    page.wait_for_selector('#organograma .card')
    page.wait_for_timeout(300)
    tag = f'{modo}{largura}'

    # Raiz com 3 filhos diretos
    verificar(f'{tag} inicial', page.evaluate(CHECAR), 4)
    shot(page, f'{tag}-1-inicial')

    # Setor com 10+ filhos (Comissões: 23)
    clicar(page, 'Comissões Legislativas')
    r = page.evaluate(CHECAR)
    verificar(f'{tag} comissões expandidas (23 filhos)', r, 4 + 23)
    print(f"        linhas verticais distintas: {r['linhasDistintas']}")
    shot(page, f'{tag}-2-comissoes')
    shot(page, f'{tag}-2-comissoes-pagina', True)

    # Recolhimento
    clicar(page, 'Comissões Legislativas')
    verificar(f'{tag} comissões recolhidas', page.evaluate(CHECAR), 4)

    # Poucos filhos e vários níveis
    clicar(page, 'Mesa Diretora')
    verificar(f'{tag} mesa diretora (6 filhos)', page.evaluate(CHECAR), 4 + 6)
    clicar(page, 'Diretoria Financeira')
    verificar(f'{tag} diretoria financeira (2 filhos)', page.evaluate(CHECAR), 4 + 6 + 2)
    clicar(page, 'Coordenação de Gestão Financeira')
    verificar(f'{tag} 4 níveis abaixo da Mesa', page.evaluate(CHECAR), 4 + 6 + 2 + 3)
    clicar(page, 'Diretoria Geral')
    verificar(f'{tag} diretoria geral (14 filhos)', page.evaluate(CHECAR), 4 + 6 + 2 + 3 + 14)
    shot(page, f'{tag}-3-niveis')
    shot(page, f'{tag}-3-niveis-pagina', True)

    # Atalho: "Vice-presidências e secretarias" leva a "Gabinetes Parlamentares"
    clicar(page, 'Vice-presidências e secretarias')
    page.wait_for_timeout(500)
    foco = page.evaluate(NOME_FOCADO)
    registrar(f'{tag} atalho leva a Gabinetes Parlamentares', foco == 'Gabinetes Parlamentares', f'foco em "{foco}"')

    # Teclado: seta direita expande, seta esquerda recolhe, aria-expanded acompanha
    card(page, 'Gabinetes Parlamentares').focus()
    page.keyboard.press('ArrowRight')
    page.wait_for_timeout(600)
    expandido = card(page, 'Gabinetes Parlamentares').get_attribute('aria-expanded')
    page.keyboard.press('ArrowLeft')
    page.wait_for_timeout(600)
    recolhido = card(page, 'Gabinetes Parlamentares').get_attribute('aria-expanded')
    registrar(f'{tag} teclado: setas expandem/recolhem e atualizam aria-expanded',
              (expandido, recolhido) == ('true', 'false'), f'{expandido}/{recolhido}')

    # Expandir tudo (194 cards)
    page.click('[data-acao="expandir-tudo"]')
    page.wait_for_timeout(900)
    verificar(f'{tag} expandir tudo', page.evaluate(CHECAR), 194)
    shot(page, f'{tag}-4-tudo-pagina', True)

    # Redimensionamento com tudo aberto
    if redimensionar_para:
        w2, h2 = redimensionar_para
        page.set_viewport_size({'width': w2, 'height': h2})
        page.wait_for_timeout(700)
        verificar(f'{tag} redimensionado para {w2}', page.evaluate(CHECAR), 194)
        page.click('[data-acao="recolher-tudo"]')
        page.wait_for_timeout(700)
        verificar(f'{tag} recolher tudo após redimensionar', page.evaluate(CHECAR), 4)
        clicar(page, 'Comissões Legislativas')
        verificar(f'{tag} comissões em {w2}px', page.evaluate(CHECAR), 4 + 23)
        shot(page, f'{tag}-5-redimensionado')
    else:
        page.click('[data-acao="recolher-tudo"]')
        page.wait_for_timeout(700)
        verificar(f'{tag} recolher tudo', page.evaluate(CHECAR), 4)

    sem_erros(tag, erros)
    ctx.close()


def troca_de_versao(browser):
    print('\n[botões de troca de versão]')
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = ctx.new_page()
    page.goto(URL['desktop'])
    page.click('text=Ver versão mobile')
    page.wait_for_load_state()
    ok1 = page.url.endswith('organograma-mobile.html')
    page.click('text=Ver versão desktop')
    page.wait_for_load_state()
    ok2 = page.url.endswith('organograma-desktop.html')
    iframes = page.locator('iframe').count()
    registrar('desktop -> mobile -> desktop, sem iframe', ok1 and ok2 and iframes == 0, (ok1, ok2, iframes))
    ctx.close()


# ---------------------------------------------------------------------------
# Recursos portados do Projeto 01
# ---------------------------------------------------------------------------

def busca(browser, modo, largura, altura):
    print(f'\n[busca {modo} {largura}x{altura}]')
    tag = f'busca-{modo}{largura}'

    # "fina" encontra "Diretoria Financeira"; escolher expande os ancestrais
    ctx, page, erros = nova_pagina(browser, modo, largura, altura)
    aguardar_organograma(page)
    page.fill('#busca-campo', 'fina')
    page.wait_for_selector('#busca-lista [role=option]')
    achados = sugestoes(page)
    registrar(f'{tag} "fina" acha Diretoria Financeira',
              any(t.startswith('Diretoria Financeira') for t in achados), achados)
    registrar(f'{tag} no máximo 12 sugestões', len(achados) <= 12, len(achados))
    shot(page, f'{tag}-1-sugestoes')
    page.click('#busca-lista [role=option]:has-text("Diretoria Financeira")')
    page.wait_for_timeout(900)
    registrar(f'{tag} clique no resultado foca o card', page.evaluate(NOME_FOCADO) == 'Diretoria Financeira',
              page.evaluate(NOME_FOCADO))
    verificar(f'{tag} ancestrais expandidos (raiz + Mesa)', page.evaluate(CHECAR), 4 + 6)
    registrar(f'{tag} Mesa Diretora ficou expandida',
              card(page, 'Mesa Diretora').get_attribute('aria-expanded') == 'true')
    registrar(f'{tag} lista fecha após escolher', page.get_attribute('#busca-campo', 'aria-expanded') == 'false')
    anuncio = page.text_content('#anuncio')
    registrar(f'{tag} anuncia "Navegando para ..." via aria-live', anuncio.startswith('Navegando para Diretoria Financeira'), anuncio)
    sem_erros(f'{tag} (clique)', erros)
    ctx.close()

    # "comissoes" (sem acento) acha "Comissões Legislativas"; seleção por teclado
    ctx, page, erros = nova_pagina(browser, modo, largura, altura)
    aguardar_organograma(page)
    page.fill('#busca-campo', 'comissoes')
    page.wait_for_selector('#busca-lista [role=option]')
    achados = sugestoes(page)
    registrar(f'{tag} "comissoes" (sem acento) acha Comissões Legislativas',
              any(t.startswith('Comissões Legislativas') for t in achados), achados)
    page.keyboard.press('ArrowDown')
    ativo = page.get_attribute('#busca-campo', 'aria-activedescendant')
    registrar(f'{tag} seta para baixo define aria-activedescendant', ativo == 'busca-opcao-0', ativo)
    page.keyboard.press('Enter')
    page.wait_for_timeout(900)
    registrar(f'{tag} Enter escolhe a opção ativa', page.evaluate(NOME_FOCADO) == 'Comissões Legislativas',
              page.evaluate(NOME_FOCADO))
    sem_erros(f'{tag} (teclado)', erros)
    ctx.close()

    # Setas circulam, Esc fecha (e depois limpa), clique fora fecha, sigla e tipo também buscam
    ctx, page, erros = nova_pagina(browser, modo, largura, altura)
    aguardar_organograma(page)
    page.fill('#busca-campo', 'diretoria')
    page.wait_for_selector('#busca-lista [role=option]')
    quantidade = len(sugestoes(page))
    page.keyboard.press('ArrowDown')
    page.keyboard.press('ArrowDown')
    segundo = page.get_attribute('#busca-campo', 'aria-activedescendant')
    page.keyboard.press('ArrowUp')
    page.keyboard.press('ArrowUp')  # volta ao topo e dá a volta para a última opção
    ultimo = page.get_attribute('#busca-campo', 'aria-activedescendant')
    registrar(f'{tag} ArrowDown/ArrowUp navegam e dão a volta',
              segundo == 'busca-opcao-1' and ultimo == f'busca-opcao-{quantidade - 1}', (segundo, ultimo, quantidade))
    page.keyboard.press('Escape')
    fechada = page.get_attribute('#busca-campo', 'aria-expanded') == 'false' and page.is_hidden('#busca-lista')
    page.keyboard.press('Escape')
    limpo = page.input_value('#busca-campo') == ''
    registrar(f'{tag} Esc fecha a lista e, de novo, limpa o campo', fechada and limpo, (fechada, limpo))

    page.fill('#busca-campo', 'ccjr')
    page.wait_for_selector('#busca-lista [role=option]')
    registrar(f'{tag} busca por sigla ("ccjr")', any('CCJR' in t for t in sugestoes(page)), sugestoes(page))
    page.fill('#busca-campo', 'ouvidoria')
    page.wait_for_selector('#busca-lista [role=option]')
    registrar(f'{tag} busca por tipo/nome ("ouvidoria")', len(sugestoes(page)) > 0)
    page.fill('#busca-campo', 'zzzzqx')
    page.wait_for_selector('#busca-lista .busca-vazio')
    registrar(f'{tag} sem resultado mostra mensagem', 'Nenhuma' in page.text_content('#busca-lista'))
    registrar(f'{tag} sem resultado anuncia', page.text_content('#anuncio') == 'Nenhum resultado', page.text_content('#anuncio'))

    page.fill('#busca-campo', 'fina')
    page.wait_for_selector('#busca-lista [role=option]')
    page.mouse.click(5, 5)  # fora do componente
    page.wait_for_timeout(150)
    registrar(f'{tag} clique fora fecha a lista', page.is_hidden('#busca-lista'))
    sem_erros(f'{tag} (outros)', erros)
    ctx.close()

    # Altura mínima de 44px do campo no mobile
    if modo == 'mobile':
        ctx, page, erros = nova_pagina(browser, modo, largura, altura)
        aguardar_organograma(page)
        altura_campo = page.evaluate("document.getElementById('busca-campo').getBoundingClientRect().height")
        registrar(f'{tag} campo com no mínimo 44px de altura', altura_campo >= 44, altura_campo)
        ctx.close()


def proximo_nivel(browser, modo, largura, altura):
    print(f'\n[expandir próximo nível {modo} {largura}x{altura}]')
    tag = f'nivel-{modo}{largura}'
    ctx, page, erros = nova_pagina(browser, modo, largura, altura)
    aguardar_organograma(page)

    # Primeiro clique pelo TECLADO (Enter no botão) - critério de acessibilidade
    page.focus('[data-acao="expandir-nivel"]')
    page.keyboard.press('Enter')
    page.wait_for_timeout(700)
    r = page.evaluate(CHECAR)
    # raiz(1) + 3 filhos diretos(3) abertos: 23 + 11 + 6 novos cards
    verificar(f'{tag} 1º clique (teclado) abre o nível 1', r, 4 + 23 + 11 + 6)
    anuncio = page.text_content('#anuncio')
    registrar(f'{tag} anuncia quantos cards novos', '40 novos cards' in anuncio, anuncio)

    anteriores = [r['cards']]
    mensagem = ''
    for _ in range(12):
        page.click('[data-acao="expandir-nivel"]')
        page.wait_for_timeout(650)
        mensagem = page.text_content('#anuncio')
        if 'já estão expandidos' in mensagem:
            break
        anteriores.append(page.evaluate(CHECAR)['cards'])
    crescente = all(b > a for a, b in zip(anteriores, anteriores[1:]))
    registrar(f'{tag} cada clique aumenta a contagem de cards', crescente, anteriores)
    verificar(f'{tag} ao final todos os 194 cards', page.evaluate(CHECAR), 194)
    registrar(f'{tag} avisa quando não há mais níveis', 'Todos os níveis já estão expandidos' in mensagem, mensagem)
    sem_erros(tag, erros)
    ctx.close()


def legenda(browser, modo, largura, altura):
    print(f'\n[legenda clicável {modo} {largura}x{altura}]')
    tag = f'legenda-{modo}{largura}'

    # Clique: primeiro nó do tipo Diretoria = Diretoria Financeira
    ctx, page, erros = nova_pagina(browser, modo, largura, altura)
    aguardar_organograma(page)
    botao = page.locator('button.legenda-item[aria-label="Ir para primeiro nó do tipo Diretoria"]')
    registrar(f'{tag} item da legenda é <button> com aria-label', botao.count() == 1)
    botao.click()
    page.wait_for_timeout(900)
    registrar(f'{tag} clique leva ao primeiro nó do tipo', page.evaluate(NOME_FOCADO) == 'Diretoria Financeira',
              page.evaluate(NOME_FOCADO))
    verificar(f'{tag} caminho expandido', page.evaluate(CHECAR), 4 + 6)
    sem_erros(f'{tag} (clique)', erros)
    ctx.close()

    # Teclado: Tab chega ao botão da legenda e Enter navega
    ctx, page, erros = nova_pagina(browser, modo, largura, altura)
    aguardar_organograma(page)
    page.focus('button.legenda-item[aria-label="Ir para primeiro nó do tipo Coordenadoria"]')
    page.keyboard.press('Enter')
    page.wait_for_timeout(900)
    registrar(f'{tag} Enter no botão navega', page.evaluate(NOME_FOCADO) == 'Coordenação de Gestão Financeira',
              page.evaluate(NOME_FOCADO))
    sem_erros(f'{tag} (teclado)', erros)
    ctx.close()


def acordeao(browser, modo, largura, altura):
    print(f'\n[acordeão nas raízes {modo} {largura}x{altura}]')
    tag = f'acordeao-{modo}{largura}'
    ctx, page, erros = nova_pagina(browser, modo, largura, altura)
    aguardar_organograma(page)
    clicar(page, 'Comissões Legislativas')
    clicar(page, 'Mesa Diretora')
    if modo == 'mobile':
        # Abrir Mesa fecha Comissões (acordeão ativo)
        verificar(f'{tag} abrir Mesa fecha Comissões', page.evaluate(CHECAR), 4 + 6)
        registrar(f'{tag} Comissões ficou recolhida',
                  card(page, 'Comissões Legislativas').get_attribute('aria-expanded') == 'false')
        # A busca ignora o acordeão: ir para uma comissão abre Comissões sem fechar a Mesa
        page.fill('#busca-campo', 'ccjr')
        page.wait_for_selector('#busca-lista [role=option]')
        page.keyboard.press('Enter')
        page.wait_for_timeout(900)
        verificar(f'{tag} busca ignora o acordeão', page.evaluate(CHECAR), 4 + 6 + 23)
    else:
        # No desktop os dois permanecem abertos
        verificar(f'{tag} desktop mantém vários ramos abertos', page.evaluate(CHECAR), 4 + 23 + 6)
    sem_erros(tag, erros)
    ctx.close()


def teclado_novos_elementos(browser, modo, largura, altura):
    print(f'\n[ordem de Tab {modo} {largura}x{altura}]')
    tag = f'tab-{modo}{largura}'
    ctx, page, erros = nova_pagina(browser, modo, largura, altura)
    aguardar_organograma(page)
    ordem = []
    page.evaluate('document.body.focus()')
    for _ in range(6):
        page.keyboard.press('Tab')
        ordem.append(page.evaluate(
            "document.activeElement.dataset.acao || document.activeElement.id || document.activeElement.className"))
    esperado = ['expandir-nivel', 'expandir-tudo', 'recolher-tudo', 'botao botao-principal', 'busca-campo', 'legenda-item']
    registrar(f'{tag} Tab percorre botões, link, busca e legenda', ordem == esperado, ordem)
    foco_visivel = page.evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none'")
    registrar(f'{tag} foco visível no item da legenda', foco_visivel)
    sem_erros(tag, erros)
    ctx.close()


def movimento_reduzido(browser):
    print('\n[prefers-reduced-motion]')
    for reduzido, rotulo in ((True, 'reduce'), (False, 'no-preference')):
        ctx, page, erros = nova_pagina(browser, 'desktop', 1280, 800, reduced_motion=('reduce' if reduzido else 'no-preference'))
        aguardar_organograma(page)
        page.fill('#busca-campo', 'fina')
        page.wait_for_selector('#busca-lista [role=option]')
        anim_lista = page.evaluate("getComputedStyle(document.getElementById('busca-lista')).animationName")
        page.keyboard.press('Enter')
        page.wait_for_timeout(1000)
        anim_pulso = page.evaluate("(() => { const c = document.querySelector('.card.pulso'); return c ? getComputedStyle(c).animationName : 'sem-pulso'; })()")
        if reduzido:
            registrar('reduced-motion: busca sem animação', anim_lista == 'none', anim_lista)
            registrar('reduced-motion: pulso sem animação', anim_pulso == 'none', anim_pulso)
        else:
            # Controle positivo: sem a preferência, as animações existem (o teste não é vazio)
            registrar('sem a preferência: busca anima', anim_lista == 'busca-entrada', anim_lista)
            registrar('sem a preferência: pulso anima', anim_pulso == 'pulso', anim_pulso)
        sem_erros(f'motion-{rotulo}', erros)
        ctx.close()


def validacao_dos_dados(browser):
    """Copia o projeto para uma pasta temporária, estraga os dados de propósito e
    confere que a página mostra um aviso claro, registra o erro e não desenha nada."""
    print('\n[validação dos dados]')
    tmp = tempfile.mkdtemp(prefix='organograma-')
    copia = os.path.join(tmp, 'p')
    shutil.copytree(RAIZ, copia, ignore=shutil.ignore_patterns('screens', '__pycache__'))
    casos = [
        ('id duplicado', "{id:'a',nome:'A',tipo:'instituicao',filhos:[{id:'a',nome:'B',tipo:'orgao',filhos:[]}]}", 'Id duplicado'),
        ('tipo desconhecido', "{id:'a',nome:'A',tipo:'instituicao',filhos:[{id:'b',nome:'B',tipo:'inexistente',filhos:[]}]}", 'Tipo desconhecido'),
        ('atalho órfão', "{id:'a',nome:'A',tipo:'instituicao',filhos:[{id:'b',nome:'B',tipo:'orgao',targetId:'zzz',filhos:[]}]}", 'não existe'),
        ('nó sem nome', "{id:'a',nome:'A',tipo:'instituicao',filhos:[{id:'b',tipo:'orgao',filhos:[]}]}", 'sem nome'),
        ('id vazio', "{id:'a',nome:'A',tipo:'instituicao',filhos:[{id:'',nome:'B',tipo:'orgao',filhos:[]}]}", 'sem id válido'),
    ]
    try:
        for nome, dados, trecho in casos:
            with open(os.path.join(copia, 'js', 'dados-organograma.js'), 'w', encoding='utf-8') as f:
                f.write(f'window.organogramaDados = {dados};')
            ctx = browser.new_context(viewport={'width': 1280, 'height': 800})
            page = ctx.new_page()
            erros = []
            page.on('console', lambda m: erros.append(m.text) if m.type == 'error' else None)
            page.goto('file://' + os.path.join(copia, 'organograma-desktop.html'))
            page.wait_for_selector('[role=alert]')
            texto = page.text_content('[role=alert]')
            registrar(f'dados com {nome}: mostra aviso com "{trecho}"', trecho in texto, texto)
            registrar(f'dados com {nome}: não desenha cards', page.locator('.card').count() == 0)
            registrar(f'dados com {nome}: registra console.error específico',
                      any('[organograma] dados inválidos' in e for e in erros), erros[:2])
            ctx.close()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def redirecionador(browser):
    print('\n[index.html]')
    for largura, esperado in ((1280, 'organograma-desktop.html'), (390, 'organograma-mobile.html'), (640, 'organograma-mobile.html'), (641, 'organograma-desktop.html')):
        ctx = browser.new_context(viewport={'width': largura, 'height': 800})
        page = ctx.new_page()
        page.goto(URL['index'])
        try:
            page.wait_for_url(lambda u: u.endswith('.html') and 'index.html' not in u, timeout=5000)
        except Exception:
            pass
        registrar(f'index.html em {largura}px vai para {esperado}', page.url.endswith(esperado), page.url)
        ctx.close()

    # Sem JavaScript: links manuais
    ctx = browser.new_context(viewport={'width': 1280, 'height': 800}, java_script_enabled=False)
    page = ctx.new_page()
    page.goto(URL['index'])
    registrar('index.html sem JavaScript oferece os dois links',
              page.locator('a[href="organograma-desktop.html"]').count() == 1
              and page.locator('a[href="organograma-mobile.html"]').count() == 1)
    ctx.close()


def cores_no_dom(browser):
    """Confere as cores REALMENTE renderizadas (não só as escritas no CSS).

    Para cada tipo de card: (1) a cor de fundo calculada pelo navegador é a do token,
    o que prova que a variável foi aplicada; (2) o contraste texto/fundo, do tipo
    escrito no card e do selo da sigla é >= 4,5:1 medido no DOM; (3) o tipo escrito
    não tem opacidade (a cor medida é a cor vista)."""
    print('\n[cores renderizadas]')
    import re

    def para_rgb(texto):
        return tuple(int(v) for v in re.findall(r'\d+', texto)[:3])

    def luminancia(rgb):
        lin = [(c / 255) / 12.92 if c / 255 <= 0.04045 else (((c / 255) + 0.055) / 1.055) ** 2.4 for c in rgb]
        return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]

    def contraste_rgb(a, b):
        la, lb = luminancia(a), luminancia(b)
        return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

    css = open(os.path.join(RAIZ, 'css', 'organograma.css'), encoding='utf-8').read()
    tokens = {}
    for bloco in re.finditer(r'(?m)^\.card-([a-z]+)\s*\{([^}]*)\}', css):
        fundo = re.search(r'--fundo:\s*#([0-9a-fA-F]{6})', bloco.group(2))
        if fundo:
            h = fundo.group(1)
            tokens[bloco.group(1)] = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

    ctx, page, erros = nova_pagina(browser, 'desktop', 1440, 900)
    aguardar_organograma(page)
    page.click('[data-acao="expandir-tudo"]')
    page.wait_for_timeout(900)
    medidas = page.evaluate("""() => {
      const out = {};
      document.querySelectorAll('#organograma .card').forEach(c => {
        const tipo = [...c.classList].map(x => x.replace('card-', '')).find(x => /^(instituicao|orgao|gabinete|diretoria|coordenadoria|gerencia|chefia|assessoria|unidade|cargo|comissao|ouvidoria)$/.test(x));
        if (!tipo || out[tipo]) return;
        const cs = getComputedStyle(c);
        const t = getComputedStyle(c.querySelector('.card-tipo'));
        const s = c.querySelector('.card-sigla');
        const ss = s ? getComputedStyle(s) : null;
        out[tipo] = {fundo: cs.backgroundColor, texto: cs.color, tipoCor: t.color, tipoOpacidade: t.opacity,
                     siglaFundo: ss && ss.backgroundColor, siglaTexto: ss && ss.color};
      });
      return out;
    }""")
    registrar('todos os 12 tipos aparecem na página expandida', len(medidas) == 12, sorted(medidas))
    for tipo, m in sorted(medidas.items()):
        fundo, texto, cor_tipo = para_rgb(m['fundo']), para_rgb(m['texto']), para_rgb(m['tipoCor'])
        registrar(f'{tipo}: fundo renderizado = token do CSS', fundo == tokens.get(tipo), (fundo, tokens.get(tipo)))
        registrar(f'{tipo}: contraste do texto >= 4,5 no DOM', contraste_rgb(texto, fundo) >= 4.5, round(contraste_rgb(texto, fundo), 2))
        registrar(f'{tipo}: contraste do tipo escrito >= 4,5 e sem opacidade',
                  contraste_rgb(cor_tipo, fundo) >= 4.5 and m['tipoOpacidade'] == '1', (m['tipoCor'], m['tipoOpacidade']))
        if m['siglaFundo']:
            c = contraste_rgb(para_rgb(m['siglaTexto']), para_rgb(m['siglaFundo']))
            registrar(f'{tipo}: contraste do selo da sigla >= 4,5 no DOM', c >= 4.5, round(c, 2))
    sem_erros('cores', erros)
    ctx.close()


def nitidez_e_padronizacao(browser):
    """Garante (1) texto NÍTIDO e (2) cards PADRONIZADOS.

    Nitidez: em repouso, cada card precisa estar alinhado à grade de pixels FÍSICOS
    (posição x densidade da tela = inteiro), ter largura/altura inteiras em px CSS e
    NÃO ter camada de GPU permanente (`will-change`). Testa densidades 1, 1.25 e 1.5
    (zoom/escala do Windows), onde o problema de texto embaçado aparecia.

    Padronização: todos os tipos têm a mesma largura, borda, cantos, preenchimento
    interno, tamanho e família de fonte (só as cores mudam) e a fonte é sem serifa."""
    print('\n[nitidez e padronização]')
    for dpr in (1, 1.25, 1.5):
        for modo, larg, alt in (('desktop', 1280, 800), ('mobile', 390, 844)):
            tag = f'nitidez-{modo}-dpr{dpr}'
            ctx = browser.new_context(viewport={'width': larg, 'height': alt}, device_scale_factor=dpr,
                                      has_touch=(modo == 'mobile'), is_mobile=(modo == 'mobile'))
            page = ctx.new_page()
            erros = []
            page.on('console', lambda m: erros.append(m.text) if m.type == 'error' else None)
            page.on('pageerror', lambda e: erros.append(str(e)))
            page.goto(URL[modo])
            aguardar_organograma(page)
            page.click('[data-acao=expandir-tudo]')
            page.wait_for_timeout(900)
            # Rola até uma posição fracionária de propósito: não pode afetar o alinhamento.
            r = page.evaluate("""(dpr) => {
              const sx = window.scrollX, sy = window.scrollY;
              const ruins = []; let n = 0, willChange = 0;
              document.querySelectorAll('#organograma .card').forEach((el) => {
                const b = el.getBoundingClientRect();
                const px = (b.left + sx) * dpr, py = (b.top + sy) * dpr;
                const frac = (v) => Math.abs(v - Math.round(v));
                n++;
                if (frac(px) > 0.02 || frac(py) > 0.02 || frac(b.width) > 0.02 || frac(b.height) > 0.02) {
                  if (ruins.length < 3) ruins.push([el.querySelector('.card-nome').textContent, b.left + sx, b.top + sy, b.width, b.height]);
                }
                if (getComputedStyle(el).willChange !== 'auto') willChange++;
              });
              return { n, ruins, willChange, animando: document.querySelector('#organograma').classList.contains('animando') };
            }""", dpr)
            registrar(f'{tag}: {r["n"]} cards alinhados à grade de pixels', not r['ruins'], r['ruins'])
            registrar(f'{tag}: sem will-change permanente', r['willChange'] == 0, r['willChange'])
            registrar(f'{tag}: classe animando removida em repouso', not r['animando'])
            sem_erros(tag, erros)
            ctx.close()

    ctx, page, erros = nova_pagina(browser, 'desktop', 1280, 800)
    aguardar_organograma(page)
    page.click('[data-acao=expandir-tudo]')
    page.wait_for_timeout(900)
    por_tipo = page.evaluate("""() => {
      const m = {};
      document.querySelectorAll('#organograma .card').forEach((el) => {
        const tipo = [...el.classList].find((c) => c.startsWith('card-') && c !== 'card-nome').slice(5);
        const cs = getComputedStyle(el), nome = getComputedStyle(el.querySelector('.card-nome'));
        const t = el.querySelector('.card-tipo');
        m[tipo] = JSON.stringify({
          w: cs.width, bw: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth],
          bs: cs.borderTopStyle, r: cs.borderTopLeftRadius, pad: cs.padding, fs: cs.fontSize, fw: cs.fontWeight,
          nfs: nome.fontSize, nfw: nome.fontWeight, tfs: t ? getComputedStyle(t).fontSize : '', fam: cs.fontFamily
        });
      });
      return m;
    }""")
    tipos = sorted(por_tipo)
    registrar(f'padronização: {len(tipos)} tipos presentes', len(tipos) >= 12, tipos)
    distintos = set(por_tipo.values())
    registrar('padronização: todos os tipos com o mesmo formato, fonte e tamanho', len(distintos) == 1,
              [t for t in tipos if por_tipo[t] != por_tipo[tipos[0]]][:4])
    fam = page.evaluate("getComputedStyle(document.querySelector('.card')).fontFamily")
    registrar('fonte: Creato Display é a primeira da pilha', fam.lower().startswith('"creato display"'), fam)
    sem_serifa = page.evaluate("""() => {
      const bons = ['.barra h1', '.busca-campo', '.botao', '.legenda-item', '.card', '.card-nome', '.busca-rotulo']
      return bons.map((s) => [s, getComputedStyle(document.querySelector(s)).fontFamily]);
    }""")
    registrar('fonte: todo o conteúdo usa a mesma pilha sem serifa',
              len({f for _, f in sem_serifa}) == 1 and 'serif' in sem_serifa[0][1].split(',')[-1] and 'Georgia' not in sem_serifa[0][1],
              sem_serifa)
    sem_erros('padronização', erros)
    ctx.close()


# Ponto de entrada da suíte: agrupa cenários por comportamento e testa os dois perfis.
with sync_playwright() as p:
    navegador = p.chromium.launch()

    # Layout e interação básicos (cenários originais)
    cenario(navegador, 'desktop', 1440, 900, redimensionar_para=(1024, 768))
    cenario(navegador, 'desktop', 1920, 1080)
    cenario(navegador, 'desktop', 800, 900)
    cenario(navegador, 'mobile', 768, 1024)
    cenario(navegador, 'mobile', 430, 932, redimensionar_para=(360, 740))
    cenario(navegador, 'mobile', 390, 844)
    cenario(navegador, 'mobile', 320, 640)
    # A versão desktop aberta num celular também não pode ter rolagem horizontal
    cenario(navegador, 'desktop', 360, 740)
    troca_de_versao(navegador)

    # Recursos portados do Projeto 01
    busca(navegador, 'desktop', 1280, 800)
    busca(navegador, 'mobile', 390, 844)
    proximo_nivel(navegador, 'desktop', 1280, 800)
    proximo_nivel(navegador, 'mobile', 390, 844)
    legenda(navegador, 'desktop', 1280, 800)
    legenda(navegador, 'mobile', 390, 844)
    acordeao(navegador, 'mobile', 390, 844)
    acordeao(navegador, 'desktop', 1280, 800)
    teclado_novos_elementos(navegador, 'desktop', 1280, 800)
    teclado_novos_elementos(navegador, 'mobile', 390, 844)
    movimento_reduzido(navegador)
    validacao_dos_dados(navegador)
    redirecionador(navegador)
    cores_no_dom(navegador)
    nitidez_e_padronizacao(navegador)
    navegador.close()

print()
if falhas:
    print(f'{len(falhas)} falha(s) em {total} verificações:')
    for nome, detalhe in falhas:
        print(' -', nome, detalhe)
    sys.exit(1)
print(f'Tudo certo: {total} verificações sem falhas')
