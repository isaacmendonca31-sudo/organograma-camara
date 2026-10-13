"""Teste de acessibilidade das cores: python3 tests/cores_test.py [--tabela]

Lê as cores DIRETO de css/organograma.css (única fonte da verdade) e confere:

  1. Contraste WCAG 2.2: texto >= 4,5:1 (AA); bordas, linhas e anel de foco >= 3:1 (1.4.11).
  2. Daltonismo: a distância perceptual (CIEDE2000) entre tipos de card, medida sob visão
     normal, protanopia, deuteranopia e tritanopia, nunca fica abaixo de LIMITE_DE.
  3. Hierarquia: a luminosidade do preenchimento cresce com o nível (quanto mais
     importante, mais escuro) e os níveis operacionais são todos claros.

Dependências (apenas para desenvolvedores, o site em si não usa nada disso):
    pip install numpy scikit-image

Simulação de daltonismo: matrizes de Machado, Oliveira e Fernandes (2009), severidade 1,0,
aplicadas em RGB linear. Distância de cor: CIEDE2000 (a mais próxima da percepção humana).
"""
import itertools
import os
import re
import sys

try:
    import numpy as np
    from skimage import color as sk
except ImportError:
    sys.exit('Instale as dependências do teste: pip install numpy scikit-image')

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(RAIZ, 'css', 'organograma.css')

# Limites do projeto (ver LEIAME.md, seção "Cores e acessibilidade").
CONTRASTE_TEXTO = 4.5      # WCAG AA para texto normal
CONTRASTE_TEXTO_ALTO = 7.0 # AAA, exigido dos níveis mais altos e do texto principal da página
CONTRASTE_NAO_TEXTO = 3.0  # WCAG 1.4.11 (bordas, linhas, anel de foco)
LIMITE_DE = 10.0           # CIEDE2000 mínimo entre tipos do mesmo nível (acima de ~5 já é visível)
LIMITE_DE_ENTRE_NIVEIS = 25.0
DEGRAU_L = 10.0            # diferença mínima de luminosidade (L*) entre níveis escuros consecutivos

# Ordem de importância dos tipos de preenchimento escuro (do nível 1 ao 3).
ESCUROS = ['instituicao', 'orgao', 'gabinete', 'diretoria']
CLAROS = ['coordenadoria', 'gerencia', 'chefia', 'assessoria', 'comissao', 'ouvidoria', 'unidade', 'cargo']

CVD = {
    'normal': np.eye(3),
    'protanopia': np.array([[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]]),
    'deuteranopia': np.array([[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]]),
    'tritanopia': np.array([[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]),
}


# ---------------------------------------------------------------------------
# Matemática de cor
# ---------------------------------------------------------------------------

def hex_rgb(h):
    """Converte uma cor #RRGGBB em três canais RGB normalizados entre 0 e 1."""
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)]) / 255


def para_linear(c):
    """Converte sRGB para luz linear, necessária para luminância e simulação CVD."""
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def de_linear(c):
    """Converte a simulação em luz linear de volta para valores sRGB exibíveis."""
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def luminancia(h):
    r, g, b = para_linear(hex_rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    """Razão de contraste WCAG entre duas cores #RRGGBB."""
    la, lb = luminancia(a), luminancia(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def lab(h, visao='normal'):
    """Aplica a visão escolhida e representa a cor em CIELAB para comparação perceptual."""
    simulada = de_linear(CVD[visao] @ para_linear(hex_rgb(h)))
    return sk.rgb2lab(simulada.reshape(1, 1, 3))[0, 0]


def distancia(a, b):
    """Menor CIEDE2000 entre a e b considerando visão normal e os três tipos de daltonismo."""
    return min(float(sk.deltaE_ciede2000(lab(a, v), lab(b, v))) for v in CVD)


# ---------------------------------------------------------------------------
# Leitura do CSS
# ---------------------------------------------------------------------------

def ler_css():
    """Lê tokens da interface e variáveis de cor dos seletores de tipo no CSS."""
    css = open(CSS, encoding='utf-8').read()
    raiz = re.search(r':root\s*\{([^}]*)\}', css).group(1)
    ui = {m.group(1): m.group(2).lower() for m in re.finditer(r'--([a-z-]+):\s*(#[0-9a-fA-F]{6})', raiz)}

    tipos = {}
    for bloco in re.finditer(r'(?m)^\.card-([a-z]+)\s*\{([^}]*)\}', css):
        nome, corpo = bloco.group(1), bloco.group(2)
        if '--fundo' not in corpo:
            continue  # .card-nome, .card-tipo, .card-sigla etc. não são tipos
        cores = {m.group(1): m.group(2).lower() for m in re.finditer(r'--([a-z-]+):\s*(#[0-9a-fA-F]{6})', corpo)}
        tipos[nome] = cores
    return ui, tipos


# ---------------------------------------------------------------------------
# Verificações
# ---------------------------------------------------------------------------

falhas = []
total = 0
resumo = {}


def exigir(nome, valor, minimo, formato='{:.1f}'):
    """Registra uma verificação `valor >= minimo`."""
    global total
    total += 1
    ok = valor >= minimo - 1e-9
    if not ok:
        falhas.append(f'{nome}: {formato.format(valor)} (mínimo {formato.format(minimo)})')
    return ok


def main():
    ui, tipos = ler_css()
    papel = ui['papel']

    faltando = [t for t in ESCUROS + CLAROS if t not in tipos]
    if faltando:
        sys.exit(f'Tipos sem cores em organograma.css: {faltando}')
    extras = [t for t in tipos if t not in ESCUROS + CLAROS]
    if extras:
        sys.exit(f'Tipos novos sem regra de teste (inclua em ESCUROS ou CLAROS): {extras}')

    # 1) Contraste dos cards ---------------------------------------------------
    menor_texto = menor_chip = menor_borda = 99
    for nome, c in tipos.items():
        minimo = CONTRASTE_TEXTO_ALTO if nome in ('instituicao', 'orgao') else CONTRASTE_TEXTO
        r = contraste(c['texto'], c['fundo'])
        menor_texto = min(menor_texto, r)
        exigir(f'texto do card {nome}', r, minimo)

        r = contraste(c['chip-texto'], c['chip-fundo'])
        menor_chip = min(menor_chip, r)
        exigir(f'selo da sigla de {nome}', r, CONTRASTE_TEXTO)

        r = contraste(c['borda'], papel)
        menor_borda = min(menor_borda, r)
        exigir(f'borda de {nome} contra o papel', r, CONTRASTE_NAO_TEXTO)
    resumo['Texto dos cards (mín.)'] = f'{menor_texto:.1f}:1 (exigido 4,5; níveis 1-2 exigem 7)'
    resumo['Selo da sigla (mín.)'] = f'{menor_chip:.1f}:1 (exigido 4,5)'
    resumo['Borda dos cards (mín.)'] = f'{menor_borda:.1f}:1 (exigido 3)'

    # 2) Contraste da interface ------------------------------------------------
    branco = '#ffffff'
    interface = [
        ('texto principal', ui['tinta'], papel, CONTRASTE_TEXTO_ALTO),
        ('texto secundário', ui['tinta-suave'], papel, CONTRASTE_TEXTO),
        ('texto secundário sobre hover', ui['tinta-suave'], ui['hover'], CONTRASTE_TEXTO),
        ('título', ui['acento-escuro'], papel, CONTRASTE_TEXTO_ALTO),
        ('botão (texto)', ui['acento'], papel, CONTRASTE_TEXTO),
        ('botão sobre hover', ui['acento'], ui['hover'], CONTRASTE_TEXTO),
        ('botão principal', branco, ui['acento'], CONTRASTE_TEXTO),
        ('botão principal em hover', branco, ui['acento-escuro'], CONTRASTE_TEXTO),
        ('texto de exemplo da busca', ui['placeholder'], branco, CONTRASTE_TEXTO),
        ('mensagem de erro', ui['erro-texto'], ui['erro-fundo'], CONTRASTE_TEXTO),
        ('borda do campo de busca', ui['campo-borda'], branco, CONTRASTE_NAO_TEXTO),
        ('conectores', ui['linha'], papel, CONTRASTE_NAO_TEXTO),
        ('conectores em destaque', ui['destaque'], papel, CONTRASTE_NAO_TEXTO),
        ('anel de foco', ui['foco'], papel, CONTRASTE_NAO_TEXTO),
        ('borda da mensagem de erro', ui['erro-borda'], papel, CONTRASTE_NAO_TEXTO),
    ]
    menor_ui = 99
    for nome, a, b, minimo in interface:
        r = contraste(a, b)
        menor_ui = min(menor_ui, r / minimo)
        exigir(nome, r, minimo)
    resumo['Interface'] = f'{len(interface)} pares verificados'

    # 3) Daltonismo: tipos do mesmo nível precisam ser diferentes ---------------
    distancias = {}

    def checar_pares(rotulo, nomes, chave):
        menor = 999
        for a, b in itertools.combinations(nomes, 2):
            d = distancia(tipos[a][chave], tipos[b][chave])
            distancias[(a, b)] = d
            menor = min(menor, d)
            exigir(f'{rotulo}: {a} x {b} (CIEDE2000, pior visão)', d, LIMITE_DE)
        return menor

    resumo['Daltonismo, níveis escuros (mín.)'] = f"{checar_pares('preenchimento', ESCUROS, 'fundo'):.1f} (exigido {LIMITE_DE:.0f})"
    resumo['Daltonismo, níveis claros (mín.)'] = f"{checar_pares('cor da borda', CLAROS, 'borda'):.1f} (exigido {LIMITE_DE:.0f})"

    menor_entre = 999
    for a, b in itertools.product(ESCUROS, CLAROS):
        d = distancia(tipos[a]['fundo'], tipos[b]['fundo'])
        menor_entre = min(menor_entre, d)
        exigir(f'níveis escuros x claros: {a} x {b}', d, LIMITE_DE_ENTRE_NIVEIS)
    resumo['Daltonismo, escuros x claros (mín.)'] = f'{menor_entre:.1f} (exigido {LIMITE_DE_ENTRE_NIVEIS:.0f})'

    d = distancia(ui['linha'], ui['destaque'])
    exigir('conector comum x conector em destaque', d, LIMITE_DE)
    resumo['Conector comum x destaque'] = f'{d:.1f} (exigido {LIMITE_DE:.0f})'

    # 4) Hierarquia por luminosidade -------------------------------------------
    L = {t: lab(tipos[t]['fundo'])[0] for t in tipos}
    exigir('hierarquia: instituição mais escura que órgão', L['orgao'] - L['instituicao'], DEGRAU_L)
    exigir('hierarquia: órgão mais escuro que gabinete', L['gabinete'] - L['orgao'], DEGRAU_L)
    # Gabinete e diretoria ficam em tons diferentes também em escala de cinza.
    exigir('hierarquia: gabinete mais escuro que diretoria', L['diretoria'] - L['gabinete'], 5.0)
    for t in ESCUROS:
        exigir(f'{t} é preenchimento escuro (L* <= 50)', 50 - L[t], 0)
    for t in CLAROS:
        exigir(f'{t} é preenchimento claro (L* >= 88)', L[t], 88)
    resumo['Luminosidade L* dos preenchimentos'] = ', '.join(f'{t} {L[t]:.0f}' for t in ESCUROS)

    # Relatório ----------------------------------------------------------------
    if '--tabela' in sys.argv:
        print('Distância CIEDE2000 (pior visão) entre cores de borda dos níveis claros:')
        for (a, b), d in sorted(distancias.items(), key=lambda kv: kv[1]):
            print(f'  {d:5.1f}  {a} x {b}')
        print()
    print('Resumo da paleta')
    for k, v in resumo.items():
        print(f'  {k}: {v}')
    print()
    if falhas:
        print(f'{len(falhas)} falha(s) em {total} verificações:')
        for f in falhas:
            print(' -', f)
        sys.exit(1)
    print(f'Tudo certo: {total} verificações de cor sem falhas')


main()
