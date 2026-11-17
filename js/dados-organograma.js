/**
 * DADOS DO ORGANOGRAMA  (é aqui que você edita a estrutura)
 *
 * ONDE ESTÁ CADA COISA (procure pelos títulos "=====" neste arquivo):
 *   1. SIGLAS ............ tabela nome -> sigla (edite para mudar ou incluir siglas)
 *   2. FERRAMENTAS ....... node(), LEG e atalhos como diretoria(), gerencia()
 *   3. ESTRUTURA ......... a árvore: gabinete, diretorias, comissões, mesa, plenário
 *
 * COMO EDITAR:
 *   - Mudar uma sigla ........ altere (ou inclua) a linha na tabela SIGLAS_OFICIAIS.
 *                              A chave corresponde ao nome usado na definição do card.
 *   - Incluir uma unidade .... adicione uma linha dentro da lista de filhos do pai:
 *                                coordenadoria('Nome da Coordenadoria', [
 *                                  gerencia('Nome da Gerência')
 *                                ])
 *   - Remover uma unidade .... apague a linha (e as filhas dela).
 *   - Unidade legislativa .... acrescente  LEG  como último argumento (ex.: node('Nome', [], LEG)).
 *   - Macrounidade ........... diretoria() já é macro. Outro card: { macro: true }.
 *   - Ordem dos cards ........ é a ordem das linhas.
 */
(() => {
  let proximoId = 0;

  // ===========================================================================
  // 1. SIGLAS  (chave = nome usado na definição do card)
  // ===========================================================================
  const SIGLAS_OFICIAIS = Object.freeze({
    'Plenário': 'CMG',
    'Mesa Diretora': 'MESA',
    'Diretoria Financeira': 'DFIN',
    'Coordenadoria de Gestão Financeira': 'CFIN',
    'Gerência da Tesouraria': 'GTES',
    'Gerência de Contabilidade': 'GCTB',
    'Chefia do Núcleo de Gestão das Obrigações Acessórias': 'NOBA',
    'Coordenadoria de Planejamento Orçamentário e Financeiro': 'CPOF',
    'Gerência de Gestão Orçamentária': 'GGOR',
    'Diretoria Legislativa': 'DLEG',
    'Chefia do Núcleo de Apoio Parlamentar': 'NPAR',
    'Coordenadoria de Expediente e Protocolo': 'CEXP',
    'Gerência de Expediente e Registro': 'GERE',
    'Chefia do Núcleo de Protocolo': 'NPRO',
    'Coordenadoria Legislativa de Plenário': 'CLPL',
    'Gerência de Apoio Legislativo': 'GLEG',
    'Gerência de Documentação': 'GDOC',
    'Gerência de Processamento e Controle': 'GPCO',
    'Gerência de Taquigrafia': 'GTAQ',
    'Chefia do Núcleo de Taquigrafia e Gravação': 'NTAG',
    'Gerência de Redação de Atas': 'GREA',
    'Núcleo de Serviços Especiais da Taquigrafia': 'NSET',
    'Núcleo de Serviços Especiais do Plenário': 'NSEP',
    'Núcleo de Serviços Especiais da Revisão da Taquigrafia': 'NSER',
    'Assessoria de Promoção à Participação Comunitária e Popular': 'APCP',
    'Diretoria Executiva Parlamentar': 'DPAR',
    'Coordenadoria Executiva Parlamentar': 'CPAR',
    'Assessoria de Execução e Fiscalização de Emendas Individuais': 'AEFE',
    'Diretoria Geral': 'DGER',
    'Chefia do Núcleo de Assistência Administrativa': 'NUAD',
    'Coordenadoria de Contratos': 'CCTT',
    'Assessoria de Gestão de Contratos': 'ACTT',
    'Gerência de Contratos': 'GCTT',
    'Chefia do Núcleo de Assistência à Gerência de Contratos': 'NCTT',
    'Coordenação de Manutenção e Serviços Gerais': 'CMSG',
    'Diretoria de Administração': 'DADM',
    'Coordenadoria de Engenharia': 'CENG',
    'Chefia do Núcleo de Apoio à Engenharia': 'NENG',
    'Coordenadoria de Contrato de Estágio e Jovem Aprendiz': 'CEJA',
    'Chefia do Núcleo de Estágio': 'NEST',
    'Coordenadoria de Controle da CEAP': 'CCAP',
    'Gerência de Controle da CEAP': 'GCAP',
    'Assessoria de Controle da CEAP': 'ACAP',
    'Diretoria de Compras e Licitações': 'DCLI',
    'Coordenadoria de Compras': 'CCOM',
    'Gerência de Cotação de Preços': 'GCOT',
    'Diretoria de Comunicação': 'DCOM',
    'Coordenadoria de Imprensa e Comunicação': 'CIMC',
    'Assessoria de Comunicação': 'ACOM',
    'Assessoria de Imprensa Interna': 'AIMI',
    'Assessoria de Mídias Digitais': 'AMID',
    'Assessoria de Relações Públicas': 'ARPU',
    'Assessoria de Radialismo e Televisão': 'ARTV',
    'Assessoria de Website': 'AWEB',
    'Coordenadoria da TV Câmara': 'CTVC',
    'Gerência de Gravação e Som': 'GSOM',
    'Chefia do Núcleo de Gravação e Som': 'NSOM',
    'Chefia do Núcleo de Áudio e Vídeo': 'NAUV',
    'Gerência de Fotojornalismo': 'GFOT',
    'Coordenadoria de Áudio e Projeção': 'CAPR',
    'Chefia do Núcleo de Áudio e Projeção': 'NAPR',
    'Diretoria de Recursos Humanos': 'DRHU',
    'Coordenadoria de Pessoal': 'COPE',
    'Chefia do Núcleo de Processos Administrativos': 'NPAD',
    'Gerência de Arquivo e Documentação': 'GARD',
    'Coordenadoria de Folha de Pagamento': 'CFOP',
    'Gerência de Processamento da Folha': 'GPFO',
    'Chefia do Núcleo de Cálculo da Folha': 'NCAF',
    'Diretoria do SESMT': 'DSMT',
    'Coordenadoria do SESMT': 'CSMT',
    'Assessoria de Apoio ao SESMT': 'ASMT',
    'Gerência Especializada em Segurança e Medicina do Trabalho': 'GSMT',
    'Diretoria de Transporte e Abastecimento': 'DTAB',
    'Coordenadoria de Transporte': 'CTRA',
    'Chefia do Núcleo de Abastecimento': 'NUAB',
    'Diretoria de Tecnologia da Informação': 'DTIN',
    'Coordenadoria de Informática': 'CINF',
    'Gerência de Hardware': 'GHAR',
    'Gerência de Suporte de Informática': 'GSIN',
    'Gerência de Software': 'GSOF',
    'Diretoria de Segurança e Inteligência': 'DSIN',
    'Serviço de Segurança da Presidência': 'SSIN',
    'Assessoria de Apoio de Segurança': 'ASIN',
    'Coordenação de Segurança e Inteligência': 'CSIN',
    'Diretoria Executiva do Cerimonial': 'DCER',
    'Assessoria de Apoio ao Cerimonial': 'ACER',
    'Núcleo de Serviços Especiais do Cerimonial': 'NCER',
    'Diretoria de Integração Social e Cidadania': 'DISC',
    'Coordenação de Integração Social e Cidadania': 'CISC',
    'Assessoria de Apoio à Integração Social e Cidadania': 'AISC',
    'Diretoria de Patrimônio e Almoxarifado': 'DPAA',
    'Coordenadoria de Patrimônio': 'CPAT',
    'Assessoria de Apoio ao Patrimônio': 'APAT',
    'Gerência de Patrimônio': 'GPAT',
    'Chefia do Núcleo de Patrimônio': 'NPAT',
    'Coordenadoria de Almoxarifado': 'CALM',
    'Assessoria de Apoio ao Almoxarifado': 'AALM',
    'Gerência de Almoxarifado': 'GALM',
    'Chefia do Núcleo de Almoxarifado': 'NALM',
    'Diretoria de Promoção de Atividades de Cultura e Ensino': 'DCEN',
    'Coordenadoria do Parlamento Jovem': 'CPAJ',
    'Assessoria do Parlamento Jovem': 'APAJ',
    'Chefia do Núcleo de Apoio ao Parlamento Jovem': 'NPAJ',
    'Coordenadoria da Escola do Legislativo': 'CELE',
    'Chefia do Núcleo de Coordenação da Escola do Legislativo': 'NCEL',
    'Assessoria Administrativa da Escola do Legislativo': 'ADEL',
    'Assessoria Acadêmica da Escola do Legislativo': 'ACEL',
    'Coordenadoria de Atividades Culturais e Comunitárias': 'CCUC',
    'Assessoria de Apoio às Atividades Culturais e Comunitárias': 'ACUC',
    'Chefia do Núcleo de Apoio às Atividades Culturais e Comunitárias': 'NCUC',
    'Diretoria das Ouvidorias': 'DOUV',
    'Coordenadoria do Canal Cidadania': 'CCID',
    'Assessoria de Apoio ao Canal Cidadania': 'ACID',
    'Chefia do Núcleo de Apoio ao Canal Cidadania': 'NCID',
    'Coordenadoria da Ouvidoria da Mulher': 'COUM',
    'Assessoria de Apoio da Ouvidoria da Mulher': 'AOUM',
    'Chefia do Núcleo de Apoio à Ouvidoria da Mulher': 'NOUM',
    'Coordenadoria da Ouvidoria Especial de Combate a Crimes Raciais': 'COCR',
    'Assessoria de Apoio da Ouvidoria Especial de Combate a Crimes Raciais': 'AOCR',
    'Chefia do Núcleo de Apoio da Ouvidoria Especial de Combate a Crimes Raciais': 'NOCR',
    'Diretoria de Transparência e Proteção de Dados': 'DTPD',
    'Coordenadoria do Portal da Transparência': 'CPTR',
    'Assessoria de Apoio ao Portal da Transparência': 'APTR',
    'Encarregado pelo Tratamento de Dados Pessoais': 'ENCD',
    'Gabinete da Presidência': 'PRES',
    'Assessoria de Articulação Política da Região Metropolitana': 'ASRM',
    'Assessoria de Apoio à Articulação Política da Região Metropolitana': 'APRM',
    'Assessoria Executiva de Assuntos Institucionais': 'AEAI',
    'Coordenadoria da Liderança de Governo': 'CLIG',
    'Assessoria de Apoio à Liderança de Governo': 'ALIG',
    'Assessoria Executiva de Imprensa da Presidência': 'AEIM',
    'Assessoria de Imprensa da Presidência': 'AIMP',
    'Controladoria Geral': 'CNTR',
    'Chefia do Núcleo de Apoio ao Controle Interno': 'NCIN',
    'Gerência de Pareceres Técnicos': 'GPTE',
    'Coordenadoria de Auditoria e Exame de Contas': 'CAEC',
    'Chefia do Núcleo de Controle Interno e Auditoria': 'NCIA',
    'Coordenadoria de Análise de Despesa de Pessoal e Contábil': 'CDPC',
    'Gerência de Folha de Pagamento e Gestão de Pessoal': 'CFOP',
    'Gerência de Análise de Pagamentos': 'GAPA',
    'Chefia de Gabinete': 'GABP',
    'Gerência de Expediente da Presidência': 'GEXP',
    'Gerência de Governança': 'GGOV',
    'Gerência de Apoio Administrativo': 'GADM',
    'Assessoria Jurídica da Presidência': 'AJUP',
    'Gerência Jurídica da Presidência': 'GJUP',
    'Assessoria Especial da Presidência I': 'AEP1',
    'Assessoria Especial da Presidência II': 'AEP2',
    'Procuradoria Geral': 'PROC',
    'Gerência de Apoio à Procuradoria': 'GPRO',
    'Secretaria Geral da Procuradoria': 'SPRO',
    'Subprocuradoria-Geral': 'SUBP',
    'Chefia do Núcleo de Assuntos Administrativos': 'NADM',
    'Chefia do Núcleo de Assuntos Extrajudiciais e Judiciais': 'NJUD',
    'Chefia do Núcleo de Assuntos Legislativos': 'NLEG',
    'Ouvidoria Especial de Combate a Crimes Raciais': 'OECCR',
    'Ouvidoria Especial da Mulher': 'OEM'
  });

  // ===========================================================================
  // 2. FERRAMENTAS PARA MONTAR A ESTRUTURA
  // ===========================================================================

  /**
   * Cria um card:  node(nome, filhos, extras)
   *   nome   texto do card
   *   filhos lista de cards subordinados (omita se não tiver)
   *   extras campos opcionais, ex.: { sigla: 'TI' } ou LEG
   *
   * Campos do card: id (gerado, não edite), nome, sigla, dimensao, macro, filhos.
   * A sigla vem da tabela SIGLAS_OFICIAIS (pelo nome) e pode ser trocada em `extras`.
   */
  const node = (nome, filhos = [], extras = {}) => ({
    id: `cmg-${++proximoId}`,
    nome,
    sigla: SIGLAS_OFICIAIS[nome],
    dimensao: 'administrativa', // cor do card: 'administrativa' (verde) ou 'legislativa' (azul)
    macro: false,               // true = macrounidade (card em destaque)
    filhos,
    ...extras
  });

  /**
   * Use LEG como último argumento para marcar um card como LEGISLATIVO (azul).
   * São legislativos: Plenário, Mesa Diretora, comissões, vice-presidências e
   * secretarias. Ouvidorias especiais e Conselho de Ética são administrativos.
   */
  const LEG = { dimensao: 'legislativa' };

  // Atalhos: cada um cria um card com menos escrita. O nome só ajuda a ler o código.
  const commission = (nome, sigla) => node(nome, [], { sigla, ...LEG });
  const chefia = (nome, filhos = []) => {
    // Exibe só "Núcleo", mantendo a sigla vinculada ao nome de origem.
    const nomeVisivel = nome.replace(/^Chefia do Núcleo/, 'Núcleo');
    return node(nomeVisivel, filhos, { sigla: SIGLAS_OFICIAIS[nome] });
  };
  const assessoria = (nome, filhos = []) => node(nome, filhos);
  const coordenadoria = (nome, filhos = []) => node(nome, filhos);
  const gerencia = (nome, filhos = []) => node(nome, filhos);
  // Toda diretoria é macrounidade (use { macro: false } no 3º argumento para abrir exceção).
  const diretoria = (nome, filhos = [], extras = {}) => node(nome, filhos, { macro: true, ...extras });

  // ===========================================================================
  // 3. ESTRUTURA  (a árvore do organograma, de baixo para cima)
  // ===========================================================================

  // Gabinete da Presidência (macrounidade): Procuradoria e Controladoria ficam no
  // mesmo nível da Chefia de Gabinete.
  const gabinetePresidencia = node('Gabinete da Presidência', [
    assessoria('Assessoria de Articulação Política da Região Metropolitana', [
      assessoria('Assessoria de Apoio à Articulação Política da Região Metropolitana')
    ]),
    assessoria('Assessoria Executiva de Assuntos Institucionais', [
      coordenadoria('Coordenadoria da Liderança de Governo', [
        assessoria('Assessoria de Apoio à Liderança de Governo')
      ])
    ]),
    assessoria('Assessoria Executiva de Imprensa da Presidência', [
      assessoria('Assessoria de Imprensa da Presidência')
    ]),
    diretoria('Controladoria Geral', [
      chefia('Chefia do Núcleo de Apoio ao Controle Interno'),
      gerencia('Gerência de Pareceres Técnicos'),
      coordenadoria('Coordenadoria de Auditoria e Exame de Contas', [
        chefia('Chefia do Núcleo de Controle Interno e Auditoria')
      ]),
      coordenadoria('Coordenadoria de Análise de Despesa de Pessoal e Contábil', [
        gerencia('Gerência de Folha de Pagamento e Gestão de Pessoal'),
        gerencia('Gerência de Análise de Pagamentos')
      ])
    ]),
    chefia('Chefia de Gabinete', [
      gerencia('Gerência de Expediente da Presidência'),
      gerencia('Gerência de Governança'),
      gerencia('Gerência de Apoio Administrativo'),
      assessoria('Assessoria Jurídica da Presidência', [
        gerencia('Gerência Jurídica da Presidência')
      ]),
      assessoria('Assessoria Especial da Presidência I'),
      assessoria('Assessoria Especial da Presidência II')
    ]),
    diretoria('Procuradoria Geral', [
      gerencia('Gerência de Apoio à Procuradoria'),
      node('Secretaria Geral da Procuradoria'),
      diretoria('Subprocuradoria-Geral', [
        chefia('Chefia do Núcleo de Assuntos Administrativos'),
        chefia('Chefia do Núcleo de Assuntos Extrajudiciais e Judiciais'),
        chefia('Chefia do Núcleo de Assuntos Legislativos')
      ], { macro: false })
    ])
  ], { macro: true });

  // ---- Diretorias da Mesa Diretora ----
  const diretoriaFinanceira = diretoria('Diretoria Financeira', [
    coordenadoria('Coordenadoria de Gestão Financeira', [
      gerencia('Gerência da Tesouraria'),
      gerencia('Gerência de Contabilidade'),
      chefia('Chefia do Núcleo de Gestão das Obrigações Acessórias')
    ]),
    coordenadoria('Coordenadoria de Planejamento Orçamentário e Financeiro', [
      gerencia('Gerência de Gestão Orçamentária')
    ])
  ]);

  const diretoriaLegislativa = diretoria('Diretoria Legislativa', [
    chefia('Chefia do Núcleo de Apoio Parlamentar'),
    coordenadoria('Coordenadoria de Expediente e Protocolo', [
      gerencia('Gerência de Expediente e Registro', [
        chefia('Chefia do Núcleo de Protocolo')
      ])
    ]),
    coordenadoria('Coordenadoria Legislativa de Plenário', [
      gerencia('Gerência de Apoio Legislativo'),
      gerencia('Gerência de Documentação'),
      gerencia('Gerência de Processamento e Controle'),
      gerencia('Gerência de Taquigrafia', [
        chefia('Chefia do Núcleo de Taquigrafia e Gravação')
      ]),
      gerencia('Gerência de Redação de Atas'),
      node('Núcleo de Serviços Especiais da Taquigrafia'),
      node('Núcleo de Serviços Especiais do Plenário'),
      node('Núcleo de Serviços Especiais da Revisão da Taquigrafia'),
      assessoria('Assessoria de Promoção à Participação Comunitária e Popular')
    ]),
    diretoria('Diretoria Executiva Parlamentar', [
      coordenadoria('Coordenadoria Executiva Parlamentar', [
        assessoria('Assessoria de Execução e Fiscalização de Emendas Individuais')
      ])
    ])
  ]);

  // Diretoria Geral e suas diretorias.
  const diretoriaGeral = diretoria('Diretoria Geral', [
    chefia('Chefia do Núcleo de Assistência Administrativa'),
    coordenadoria('Coordenadoria de Contratos', [
      assessoria('Assessoria de Gestão de Contratos'),
      gerencia('Gerência de Contratos', [
        chefia('Chefia do Núcleo de Assistência à Gerência de Contratos')
      ])
    ]),
    coordenadoria('Coordenação de Manutenção e Serviços Gerais'),
    diretoria('Diretoria de Administração', [
      coordenadoria('Coordenadoria de Engenharia', [
        chefia('Chefia do Núcleo de Apoio à Engenharia')
      ]),
      coordenadoria('Coordenadoria de Contrato de Estágio e Jovem Aprendiz', [
        chefia('Chefia do Núcleo de Estágio')
      ]),
      coordenadoria('Coordenadoria de Controle da CEAP', [
        gerencia('Gerência de Controle da CEAP'),
        assessoria('Assessoria de Controle da CEAP')
      ])
    ]),
    diretoria('Diretoria de Compras e Licitações', [
      node('Agente de Contratação'),
      coordenadoria('Coordenadoria de Compras', [
        gerencia('Gerência de Cotação de Preços')
      ])
    ]),
    diretoria('Diretoria de Comunicação', [
      coordenadoria('Coordenadoria de Imprensa e Comunicação', [
        assessoria('Assessoria de Comunicação'),
        assessoria('Assessoria de Imprensa Interna'),
        assessoria('Assessoria de Mídias Digitais'),
        assessoria('Assessoria de Relações Públicas'),
        assessoria('Assessoria de Radialismo e Televisão'),
        assessoria('Assessoria de Website')
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
      node('Serviço de Segurança da Presidência'),
      assessoria('Assessoria de Apoio de Segurança'),
      coordenadoria('Coordenação de Segurança e Inteligência')
    ]),
    diretoria('Diretoria Executiva do Cerimonial', [
      assessoria('Assessoria de Apoio ao Cerimonial'),
      node('Núcleo de Serviços Especiais do Cerimonial')
    ]),
    diretoria('Diretoria de Integração Social e Cidadania', [
      coordenadoria('Coordenação de Integração Social e Cidadania', [
        assessoria('Assessoria de Apoio à Integração Social e Cidadania')
      ])
    ]),
    diretoria('Diretoria de Patrimônio e Almoxarifado', [
      coordenadoria('Coordenadoria de Patrimônio'),
      assessoria('Assessoria de Apoio ao Patrimônio'),
      gerencia('Gerência de Patrimônio', [
        chefia('Chefia do Núcleo de Patrimônio')
      ]),
      coordenadoria('Coordenadoria de Almoxarifado'),
      assessoria('Assessoria de Apoio ao Almoxarifado', [
        gerencia('Gerência de Almoxarifado', [
          chefia('Chefia do Núcleo de Almoxarifado')
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
      coordenadoria('Coordenadoria da Ouvidoria Especial de Combate a Crimes Raciais', [
        assessoria('Assessoria de Apoio da Ouvidoria Especial de Combate a Crimes Raciais', [
          chefia('Chefia do Núcleo de Apoio da Ouvidoria Especial de Combate a Crimes Raciais')
        ])
      ])
    ]),
    diretoria('Diretoria de Transparência e Proteção de Dados', [
      coordenadoria('Coordenadoria do Portal da Transparência', [
        assessoria('Assessoria de Apoio ao Portal da Transparência')
      ]),
      node('Encarregado pelo Tratamento de Dados Pessoais')
    ])
  ]);

  const gabinetesParlamentares = node('Gabinetes Parlamentares');

  // ---- Ramo da Mesa com comissões, Conselho de Ética e Ouvidorias Especiais ----
  const comissoesLegislativas = node('Comissões Legislativas', [
    commission('Comissão de Cultura', 'CC'),
    commission('Comissão de Constituição, Justiça e Redação', 'CCJR'),
    commission('Comissão de Direitos do Consumidor', 'CDC'),
    commission('Comissão de Direitos da Criança e Adolescente', 'CDCA'),
    commission('Comissão da Defesa e dos Direitos da Mulher', 'CDDM'),
    commission('Comissão de Direitos Humanos e Cidadania', 'CDHC'),
    commission('Comissão de Direitos dos Idosos', 'CDI'),
    commission('Comissão de Educação, Ciência e Tecnologia', 'CECT'),
    commission('Comissão de Empreendedorismo, Cooperativismo, Desenvolvimento Econômico e Social', 'CEDES'),
    node('Conselho de Ética e Decoro Parlamentar', [], { sigla: 'CEDP' }),
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
    commission('Comissão do Trabalho e Servidores Públicos', 'CTSP'),
    node('Ouvidoria Especial de Combate a Crimes Raciais'),
    node('Ouvidoria Especial da Mulher')
  ], LEG);

  const vicePresidenciasSecretarias = node('Vice-presidências e secretarias', [
    ...[1, 2, 3, 4].map((numero) => node(`${numero}ª Vice-Presidência`, [], LEG)),
    ...[1, 2, 3, 4, 5].map((numero) => node(`${numero}ª Secretaria`, [], LEG)),
    ...[1, 2].map((numero) => node(`${numero}ª Vice-Presidência Corregedoria`, [], LEG))
  ], LEG);

  // Mesa Diretora: cinco ramos diretos.
  const mesaDiretora = node('Mesa Diretora', [
    diretoriaFinanceira,
    diretoriaGeral,
    diretoriaLegislativa,
    gabinetePresidencia,
    vicePresidenciasSecretarias
  ], LEG);

  // Plenário: raiz do organograma, com três ramos.
  const dados = node('Plenário', [
    comissoesLegislativas,
    gabinetesParlamentares,
    mesaDiretora
  ], { sigla: 'CMG', ...LEG });

  window.organogramaDados = dados;
})();
