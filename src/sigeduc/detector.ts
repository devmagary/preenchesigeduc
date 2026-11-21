export type SigeducScreenType =
  | 'login'
  | 'menu_principal'
  | 'portal_docente'
  | 'lancar_notas'
  | 'avaliacoes_nao_realizadas'
  | 'lancar_frequencia'
  | 'gerenciar_avaliacoes'
  | 'conteudo_ministrado'
  | 'desconhecida';

export interface ScreenDetection {
  screen: SigeducScreenType;
  label: string;
  badge: string;
  sessionExpired: boolean;
  url: string;
}

export function detectSigeducScreen(doc: Document, urlStr: string): ScreenDetection {
  const url = urlStr || '';
  const hasLoginForm =
    Boolean(doc.querySelector('form[action*="logar.do"]')) ||
    (Boolean(doc.querySelector('#email[name="user.login"]')) &&
      Boolean(doc.querySelector('#senha[name="user.senha"]')));

  if (hasLoginForm || url.includes('verTelaLogin.do')) {
    return {
      screen: 'login',
      label: 'Tela de Login (sessão não iniciada)',
      badge: 'Login',
      sessionExpired: true,
      url,
    };
  }

  // Avaliações Não Realizadas (deve vir antes de lancar_notas pois também usa form#formulario e tabViewId)
  const naoRealizadasForm = doc.querySelector(
    'form#formulario[action*="form_estudantes_realizacoes_avaliacoes"]'
  );
  if (
    naoRealizadasForm ||
    Boolean(doc.getElementById('formulario:btnAbrirConfirmacaoSenhaFv')) ||
    Boolean(doc.getElementById('formulario:confirmarGravacaoFvTurmaRegular'))
  ) {
    return {
      screen: 'avaliacoes_nao_realizadas',
      label: 'Verificar Avaliações Não Realizadas',
      badge: 'Não Realiz.',
      sessionExpired: false,
      url,
    };
  }

  // Notas: verificar form action ou estrutura #formulario:tabViewId
  const notasForm = doc.querySelector(
    'form#formulario[action*="lancar_notas"], form#formulario[action*="form_estudantes_notas"]'
  );
  if (notasForm || (doc.querySelector('#formulario\\:tabViewId') && doc.querySelector('#formulario'))) {
    return {
      screen: 'lancar_notas',
      label: 'Lançar Resultados (Notas)',
      badge: 'Notas',
      sessionExpired: false,
      url,
    };
  }

  // Frequência: verificar #formCalendarios e #formFrequencia
  if (
    doc.querySelector('#formCalendarios') &&
    (doc.querySelector('#formFrequencia') || doc.querySelector('form[action*="frequencia_aluno"]'))
  ) {
    return {
      screen: 'lancar_frequencia',
      label: 'Informar Frequência',
      badge: 'Frequência',
      sessionExpired: false,
      url,
    };
  }

  // Gerenciar Avaliações das Unidades
  if (
    doc.querySelector('form[action*="grupo_avaliacao_unidade"]') ||
    doc.body?.textContent?.includes('Gerenciar Grupos de Avaliação da Unidade') ||
    doc.body?.textContent?.includes('Cadastrar Atividades Avaliativas da Unidade')
  ) {
    return {
      screen: 'gerenciar_avaliacoes',
      label: 'Gerenciar Avaliações das Unidades',
      badge: 'Avaliações',
      sessionExpired: false,
      url,
    };
  }

  // Conteúdo Ministrado
  if (
    doc.body?.textContent?.includes('Cadastrar Conteúdo Ministrado') ||
    doc.querySelector('#seta_1')
  ) {
    return {
      screen: 'conteudo_ministrado',
      label: 'Conteúdo Ministrado',
      badge: 'Conteúdo',
      sessionExpired: false,
      url,
    };
  }

  // Portal Docente
  if (
    doc.querySelector('table[id$="turmasProfessorTable"]') ||
    doc.querySelector('#turmas-portal') ||
    url.includes('portais/docente/docente.jsf') ||
    url.includes('verPortalDocente.do')
  ) {
    return {
      screen: 'portal_docente',
      label: 'Portal Docente (Minhas Turmas)',
      badge: 'Turmas',
      sessionExpired: false,
      url,
    };
  }

  if (url.includes('verMenuPrincipal.do')) {
    return {
      screen: 'menu_principal',
      label: 'Menu Principal do SIGEduc',
      badge: 'Menu',
      sessionExpired: false,
      url,
    };
  }

  return {
    screen: 'desconhecida',
    label: 'Outra tela do SIGEduc',
    badge: 'SIGEduc',
    sessionExpired: false,
    url,
  };
}
