# Implementação no site da câmara

## É possível?

Sim. O organograma é HTML, CSS e JavaScript puros, sem build e sem servidor próprio; basta publicar a pasta em um endereço e apontar um `<iframe>` para `index.html`. O resultado aparece dentro da página do site (por exemplo, "Organograma interativo"), com o topo, o menu e o rodapé do próprio portal em volta.

Para ver como fica: abra `exemplo-no-site.html` (esqueleto genérico de página com o organograma incorporado; não é o modelo real do portal).

## Como colocar no site (iframe)

1. Publique a pasta do projeto num endereço (pode ser o próprio portal ou o servidor da transparência). Exemplo: `https://exemplo.go.leg.br/organograma/`.
2. Na página do site, cole o trecho abaixo, trocando o `src`:

```html
<iframe id="organograma-cmg"
        src="https://exemplo.go.leg.br/organograma/index.html"
        title="Organograma interativo da Câmara Municipal de Goiânia"
        style="display:block;width:100%;max-width:100%;min-width:0;height:640px;border:0"
        loading="lazy"></iframe>
<script>
  // Ajusta a altura do quadro à do organograma (a página incorporada avisa a cada mudança).
  window.addEventListener('message', function (evento) {
    var quadro = document.getElementById('organograma-cmg');
    if (!quadro || evento.source !== quadro.contentWindow) return;   // só aceita o próprio quadro
    if (!evento.data || evento.data.tipo !== 'organograma-cmg:altura') return;
    quadro.style.height = Math.ceil(evento.data.altura) + 'px';
  });
</script>
```

Sem o `<script>`, nada quebra: o quadro fica com a altura do `style` e o organograma rola dentro dele.

O quadro ocupa a largura disponível, sem largura mínima fixa. O perfil é escolhido pela largura interna do organograma, e o layout quebra os ramos em linhas antes de exceder esse espaço. A suíte de navegador verifica `scrollWidth <= clientWidth` na página hospedeira e no quadro, com todos os ramos expandidos. O exemplo de incorporação é testado em 320 px, 390 px e 1280 px; a página própria também é testada em várias larguras estreitas.

## O que muda dentro do quadro

A página reconhece sozinha que está num `<iframe>` (ou com `?incorporado` na URL; `?incorporado=0` desliga) e então:

- esconde o cabeçalho azul de identificação e o "Voltar ao site" (ficam só para leitores de tela), porque o portal já tem topo, menu e caminho de navegação;
- mantém os botões **Expandir próximo nível / Expandir tudo / Recolher tudo** e o link **Organograma em PDF**;
- deixa a barra de ferramentas de ser fixa (o quadro cresce até o tamanho do conteúdo e quem rola é a página do site);
- desenha um contorno tracejado com afastamento ao redor da área do diagrama, para indicar os limites do organograma incorporado sem alterar seu layout;
- muda de perfil conforme a **largura do quadro** (até 640 px = celular, com acordeão), então um celular abrindo a página do site recebe o layout certo.

## Navegação (o que a página oferece)

| Elemento | Onde | Observação |
|---|---|---|
| Identificação (Câmara Municipal de Goiânia + título) | Topo da página própria | No quadro, quem identifica é o site |
| Voltar ao site | Topo da página própria | `https://www.goiania.go.leg.br/`; `target="_top"` |
| Organograma em PDF | Barra, à direita | Abre em nova aba (é um arquivo, não a interface) |

## Cuidados

- **Mesma origem não é necessária:** a altura viaja por `postMessage`, que funciona entre endereços diferentes. Por segurança, o ouvinte confere `evento.source`.
- **Política de quadros do servidor:** se o servidor que hospeda o organograma enviar `X-Frame-Options` ou `Content-Security-Policy: frame-ancestors` restritivos, o site não consegue exibi-lo. Libere o domínio do portal em `frame-ancestors`.
- **Acessibilidade:** o `<iframe>` precisa do atributo `title` (já está no trecho). O foco do teclado entra e sai do quadro normalmente.
- **Rolagem horizontal:** o teste do exemplo cobre 320 px, 390 px e 1280 px, com o diagrama expandido. Isso valida o código e o exemplo do projeto; a página hospedeira também deve manter o quadro em um contêiner fluido (`width:100%`, sem largura mínima).
- **Fonte:** a Calibri do manual da CMG só existe em parte dos aparelhos; ver `LEIAME.md`, seção "Tema".
