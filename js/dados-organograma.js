(() => {
  let nextNodeId = 0;

  /*
   * GUIA RÁPIDO PARA EDITAR O ORGANOGRAMA
   *
   * Cada card é criado com node(nome, tipo, filhos, metadata):
   *   node('Nova Diretoria', 'diretoria', [
   *     coordenadoria('Nova Coordenadoria', [
   *       gerencia('Nova Gerência')
   *     ])
   *   ])
   *
   * O terceiro argumento é uma lista de filhos; sem filhos, omita-o. Cada item
   * dessa lista fica subordinado ao nó que a contém. `node` monta os campos
   * id, nome, tipo, cargo e filhos; `metadata` acrescenta campos opcionais.
   * Use, por exemplo, { sigla: 'TI' } para exibir/pesquisar uma sigla ou
   * { targetId: outroCard.id } para criar um atalho para um card existente.
   * O `id` identifica o card para o navegador, o estado salvo e os atalhos;
   * ele é interno e não precisa ser escrito manualmente.
   * Para adicionar um setor inteiro, crie a variável aqui junto das demais estruturas
   * e inclua-a no array "filhos" do pai correto, mais abaixo em "Árvore institucional".
   *
   * Os auxiliares commission/chefia/assessoria/coordenadoria/gerencia/diretoria
   * são atalhos para criar tipos recorrentes com menos repetição; use node()
   * diretamente quando o tipo não tiver um auxiliar próprio.
   *
   * IDs são gerados automaticamente por node() em cada carregamento; não os edite.
   * Ao criar um tipo visual novo, inclua-o em ROTULOS_TIPO (js/organograma-core.js) e
   * crie sua regra .card-<tipo> em css/organograma.css. A legenda das duas páginas é
   * gerada automaticamente a partir dos tipos usados nos dados.
   */
  const node = (nome, tipo, filhos = [], metadata = {}) => ({
    id: `cmg-${++nextNodeId}`,
    nome,
    tipo,
    cargo: tipo,
    filhos,
    ...metadata
  });

  const commission = (nome, sigla) => node(nome, 'comissao', [], { sigla });
  const chefia = (nome) => node(nome, 'chefia');
  const assessoria = (nome, filhos = []) => node(nome, 'assessoria', filhos);
  const coordenadoria = (nome, filhos = []) => node(nome, 'coordenadoria', filhos);
  const gerencia = (nome, filhos = []) => node(nome, 'gerencia', filhos);
  const diretoria = (nome, filhos = []) => node(nome, 'diretoria', filhos);

  // Detalhamento da Presidência. O array recebido por node/assessoria/diretoria
  // define as conexões: cada item listado passa a ser filho daquele card.
  const gabinetePresidencia = node('Gabinete da Presidência', 'gabinete', [
    chefia('Chefia de Gabinete'),
    gerencia('Gerência de Expediente da Presidência'),
    gerencia('Gerência de Governança'),
    gerencia('Gerência de Apoio Administrativo'),
    assessoria('Assessoria Jurídica da Presidência', [
      gerencia('Gerência Jurídica da Presidência')
    ]),
    assessoria('Assessoria Especial da Presidência I'),
    assessoria('Assessoria Especial da Presidência II'),
    assessoria('Assessoria de Articulação Política da Região Metropolitana', [
      assessoria('Assessoria de Apoio à Articulação Política da Região Metropolitana')
    ]),
    assessoria('Assessoria Executiva de Imprensa da Presidência', [
      assessoria('Assessoria de Imprensa da Presidência')
    ]),
    assessoria('Assessoria Executiva de Assuntos Institucionais', [
      coordenadoria('Coordenação da Liderança de Governo', [
        assessoria('Assessoria de Apoio à Liderança de Governo')
      ])
    ]),
    diretoria('Procuradoria Geral', [
      gerencia('Gerência de Apoio à Procuradoria'),
      node('Secretaria Geral da Procuradoria', 'unidade'),
      diretoria('Subprocuradoria Geral', [
        chefia('Chefia do Núcleo de Assuntos Administrativos'),
        chefia('Chefia do Núcleo de Assuntos Extrajudiciais e Judiciais'),
        chefia('Chefia do Núcleo de Assuntos Legislativos')
      ])
    ]),
    diretoria('Controladoria Geral', [
      chefia('Chefia do Núcleo de Apoio ao Controle Interno'),
      gerencia('Gerência de Pareceres Técnicos'),
      coordenadoria('Coordenação de Auditoria e Exame de Contas', [
        chefia('Chefia do Núcleo de Controle Interno e Auditoria')
      ]),
      coordenadoria('Coordenação de Análise de Despesa de Pessoal e Contábil', [
        gerencia('Gerência de Folha de Pagamentos e Gestão de Pessoal'),
        gerencia('Gerência de Análise de Pagamentos')
      ])
    ])
  ]);

  // Diretorias funcionais e suas unidades subordinadas.
  const diretoriaFinanceira = diretoria('Diretoria Financeira', [
    coordenadoria('Coordenação de Gestão Financeira', [
      gerencia('Gerência da Tesouraria'),
      gerencia('Gerência de Contabilidade'),
      chefia('Chefia do Núcleo de Gestão das Obrigações Acessórias')
    ]),
    coordenadoria('Coordenação de Planejamento Orçamentário e Financeiro', [
      gerencia('Gerência de Gestão Orçamentária')
    ])
  ]);

  const diretoriaLegislativa = diretoria('Diretoria Legislativa', [
    chefia('Chefia do Núcleo de Apoio Parlamentar'),
    coordenadoria('Coordenação de Expediente e Protocolo', [
      gerencia('Gerência de Expediente e Registro', [
        chefia('Chefia do Núcleo de Protocolo')
      ])
    ]),
    coordenadoria('Coordenação Legislativa de Plenário', [
      gerencia('Gerência de Apoio Legislativo'),
      gerencia('Gerência de Documentação'),
      gerencia('Gerência de Processamento e Controle'),
      gerencia('Gerência de Taquigrafia', [
        chefia('Chefia do Núcleo de Taquigrafia e Gravação')
      ]),
      gerencia('Gerência de Redação de Atas'),
      node('Núcleo de Serviços Especiais da Taquigrafia', 'unidade'),
      node('Núcleo de Serviços Especiais do Plenário', 'unidade'),
      node('Núcleo de Serviços Especiais da Revisão da Taquigrafia', 'unidade'),
      assessoria('Assessoria de Promoção à Participação Comunitária e Popular')
    ]),
    diretoria('Diretoria Executiva Parlamentar', [
      coordenadoria('Coordenadoria Executiva Parlamentar', [
        assessoria('Assessoria de Execução e Fiscalização de Emendas Individuais')
      ])
    ])
  ]);

  // Estrutura administrativa geral da Câmara Municipal.
  const diretoriaGeral = diretoria('Diretoria Geral', [
    diretoria('Diretoria de Administração', [
      chefia('Chefia do Núcleo de Assistência Administrativa'),
      coordenadoria('Coordenadoria de Contratos', [
        assessoria('Assessoria de Gestão de Contratos'),
        gerencia('Gerência de Contratos', [
          chefia('Chefia do Núcleo de Assistência à Gerência de Contratos')
        ])
      ]),
      coordenadoria('Coordenação de Manutenção e Serviços Gerais'),
      coordenadoria('Coordenação de Engenharia', [
        chefia('Chefia do Núcleo de Apoio à Engenharia')
      ]),
      coordenadoria('Coordenação de Contrato de Estágio e Jovem Aprendiz', [
        chefia('Chefia do Núcleo de Estágio')
      ]),
      coordenadoria('Coordenação de Controle da CEAP', [
        gerencia('Gerência de Controle da CEAP'),
        assessoria('Assessoria de Controle da CEAP')
      ])
    ]),
    diretoria('Diretoria de Compras e Licitações', [
      node('Agente de Contratação', 'cargo'),
      coordenadoria('Coordenadoria de Compras', [
        gerencia('Gerência de Cotação de Preços')
      ])
    ]),
    diretoria('Diretoria de Comunicação', [
      coordenadoria('Coordenação de Imprensa e Comunicação', [
        assessoria('Assessoria de Comunicação'),
        assessoria('Assessoria de Imprensa Interna'),
        assessoria('Assessoria de Mídias Digitais'),
        assessoria('Assessoria de Relações Públicas'),
        assessoria('Assessoria de Radialismo e Televisão'),
        assessoria('Assessor de Website')
      ]),
      coordenadoria('Coordenadoria da TV Câmara', [
        gerencia('Gerência de Gravação e Som', [
          chefia('Chefia do Núcleo de Gravação e Som'),
          chefia('Chefia do Núcleo de Áudio e Vídeo')
        ]),
        gerencia('Gerência de Fotojornalismo')
      ]),
      coordenadoria('Coordenadoria de Áudio e Projeção', [
        chefia('Chefia do Núcleo de Áudio e Projeção')
      ])
    ]),
    diretoria('Diretoria de Recursos Humanos', [
      coordenadoria('Coordenadoria de Pessoal', [
        chefia('Chefia do Núcleo de Processos Administrativos'),
        gerencia('Gerência de Arquivo e Documentação')
      ]),
      coordenadoria('Coordenadoria de Folha de Pagamento', [
        gerencia('Gerência de Processamento da Folha', [
          chefia('Chefia do Núcleo de Cálculo da Folha')
        ])
      ])
    ]),
    diretoria('Diretoria do SESMT', [
      coordenadoria('Coordenadoria do SESMT'),
      assessoria('Assessoria de Apoio ao SESMT', [
        gerencia('Gerência Especializada em Segurança e Medicina do Trabalho')
      ])
    ]),
    diretoria('Diretoria de Transporte e Abastecimento', [
      coordenadoria('Coordenadoria de Transporte', [
        chefia('Chefia do Núcleo de Abastecimento')
      ])
    ]),
    diretoria('Diretoria de Tecnologia da Informação', [
      coordenadoria('Coordenadoria de Informática', [
        gerencia('Gerência de Hardware'),
        gerencia('Gerência de Suporte de Informática'),
        gerencia('Gerência de Software')
      ])
    ]),
    diretoria('Diretoria de Segurança e Inteligência', [
      node('Serviço de Segurança da Presidência', 'unidade'),
      assessoria('Assessoria de Apoio de Segurança'),
      coordenadoria('Coordenação de Segurança e Inteligência')
    ]),
    diretoria('Diretoria Executiva do Cerimonial', [
      assessoria('Assessoria de Apoio ao Cerimonial'),
      node('Núcleo de Serviços Especiais do Cerimonial', 'unidade')
    ]),
    diretoria('Diretoria de Integração Social e Cidadania', [
      coordenadoria('Coordenação de Integração Social e Cidadania', [
        assessoria('Assessoria de Apoio à Integração Social e Cidadania')
      ])
    ]),
    diretoria('Diretoria de Patrimônio e Almoxarifado', [
      coordenadoria('Coordenadoria de Patrimônio', [
        assessoria('Assessoria de Apoio ao Patrimônio'),
        gerencia('Gerência de Patrimônio', [
          chefia('Chefia do Núcleo de Patrimônio')
        ])
      ]),
      coordenadoria('Coordenadoria de Almoxarifado', [
        assessoria('Assessoria de Apoio ao Almoxarifado', [
          gerencia('Gerência de Almoxarifado', [
            chefia('Chefia do Núcleo de Almoxarifado')
          ])
        ])
      ])
    ]),
    diretoria('Diretoria de Promoção de Atividades de Cultura e Ensino', [
      coordenadoria('Coordenadoria do Parlamento Jovem', [
        assessoria('Assessoria do Parlamento Jovem'),
        chefia('Chefia do Núcleo de Apoio ao Parlamento Jovem')
      ]),
      coordenadoria('Coordenadoria da Escola do Legislativo', [
        chefia('Chefia do Núcleo de Coordenação da Escola do Legislativo', [
          assessoria('Assessoria Administrativa da Escola do Legislativo', [
            assessoria('Assessoria Acadêmica da Escola do Legislativo')
          ])
        ])
      ]),
      coordenadoria('Coordenadoria de Atividades Culturais e Comunitárias', [
        assessoria('Assessoria de Apoio às Atividades Culturais e Comunitárias', [
          chefia('Chefia do Núcleo de Apoio às Atividades Culturais e Comunitárias')
        ])
      ])
    ]),
    diretoria('Diretoria das Ouvidorias', [
      coordenadoria('Coordenadoria do Canal Cidadania', [
        assessoria('Assessoria de Apoio ao Canal Cidadania', [
          chefia('Chefia do Núcleo de Apoio ao Canal Cidadania')
        ])
      ]),
      coordenadoria('Coordenadoria da Ouvidoria da Mulher', [
        assessoria('Assessoria de Apoio da Ouvidoria da Mulher', [
          chefia('Chefia do Núcleo de Apoio à Ouvidoria da Mulher')
        ])
      ]),
      coordenadoria('Coordenação da Ouvidoria Especial de Combate a Crimes Raciais', [
        assessoria('Assessoria de Apoio da Ouvidoria Especial de Combate a Crimes Raciais', [
          chefia('Chefia do Núcleo de Apoio da Ouvidoria Especial de Combate a Crimes Raciais')
        ])
      ])
    ]),
    diretoria('Diretoria de Transparência e Proteção de Dados', [
      coordenadoria('Coordenadoria do Portal da Transparência', [
        assessoria('Assessoria de Apoio ao Portal da Transparência')
      ]),
      node('Encarregado pelo Tratamento de Dados Pessoais', 'cargo')
    ])
  ]);

  const gabinetesParlamentares = node('Gabinetes Parlamentares', 'unidade', [
    ...[1, 2, 3, 4].map((numero) => node(`${numero}ª Vice-Presidência`, 'cargo')),
    ...[1, 2, 3, 4, 5].map((numero) => node(`${numero}ª Secretaria`, 'cargo')),
    ...[1, 2].map((numero) => node(`${numero}ª Vice-Presidência - Corregedoria`, 'cargo'))
  ]);

  // Comissões legislativas fornecidas como dados de estudo; cada sigla é exibida no card.
  const comissoesLegislativas = node('Comissões Legislativas', 'comissao', [
    commission('Comissão de Cultura', 'CC'),
    commission('Comissão de Constituição, Justiça e Redação', 'CCJR'),
    commission('Comissão de Direitos do Consumidor', 'CDC'),
    commission('Comissão de Direitos da Criança e Adolescente', 'CDCA'),
    commission('Comissão da Defesa e dos Direitos da Mulher', 'CDDM'),
    commission('Comissão de Direitos Humanos e Cidadania', 'CDHC'),
    commission('Comissão de Direitos dos Idosos', 'CDI'),
    commission('Comissão de Educação, Ciência e Tecnologia', 'CECT'),
    commission('Comissão de Empreendedorismo, Cooperativismo, Desenvolvimento Econômico e Social', 'CEDES'),
    commission('Conselho de Ética e Decoro Parlamentar', 'CEDP'),
    commission('Comissão de Finanças, Orçamento e Economia', 'CFOE'),
    commission('Comissão de Fiscalização do Transporte Público Coletivo', 'CFTPC'),
    commission('Comissão de Habitação, Urbanismo e Ordenamento Urbano', 'CHUOU'),
    commission('Comissão de Lazer, Esporte e Turismo', 'CLET'),
    commission('Comissão de Legislação Participativa', 'CLP'),
    commission('Comissão Mista', 'CM'),
    commission('Comissão do Meio Ambiente', 'CMA'),
    commission('Comissão de Obras e Patrimônio', 'COP'),
    commission('Comissão de Proteção, Direitos e Defesa dos Animais', 'CPDDA'),
    commission('Comissão das Pessoas Portadoras de Deficiência e/ou Necessidades Especiais', 'CPPDNE'),
    commission('Comissão de Saúde e Assistência Social', 'CSAS'),
    commission('Comissão de Segurança Pública e Patrimonial', 'CSPP'),
    commission('Comissão do Trabalho e Servidores Públicos', 'CTSP')
  ]);

  const ouvidoriasEspeciais = node('Ouvidorias Especiais', 'unidade', [
    node('Ouvidoria Especial de Combate a Crimes Raciais', 'ouvidoria', [], { sigla: 'OECCR' }),
    node('Ouvidoria Especial da Mulher', 'ouvidoria', [], { sigla: 'OEM' })
  ]);

  diretoriaFinanceira.sigla = 'DFIN';
  diretoriaGeral.sigla = 'DGER';
  diretoriaLegislativa.sigla = 'DLEG';
  gabinetePresidencia.sigla = 'PRES';
  gabinetesParlamentares.sigla = 'VPCS';

  // A estrutura segue o organograma de referência: Comissões, Gabinetes e Mesa.
  // Os cards da Mesa abrem cada organograma setorial diretamente no próprio diagrama.
  const mesaDiretora = node('Mesa Diretora', 'orgao', [
    diretoriaFinanceira,
    diretoriaGeral,
    diretoriaLegislativa,
    gabinetePresidencia,
    node('Vice-presidências e secretarias', 'unidade', [], {
      sigla: 'VPCS',
      targetId: gabinetesParlamentares.id
    }),
    ouvidoriasEspeciais
  ]);

  // Ponto de entrada da árvore. O sigla CMG identifica o Plenário no documento oficial.
  const dados = node('Plenário', 'instituicao', [
    comissoesLegislativas,
    gabinetesParlamentares,
    mesaDiretora
  ], { sigla: 'CMG' });

  window.organogramaDados = dados;
})();
