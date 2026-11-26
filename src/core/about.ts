export const APP_NAME = 'Preenche SIGEduc';
export const APP_REPO_URL = 'https://github.com/devmagary/preenchesigeduc';
export const APP_PORTAL_URL = 'https://is.gd/sigeduc';
export const APP_PRIVACY_URL = 'https://devmagary.github.io/preenchesigeduc/privacidade.html';

export interface AboutSectionItem {
  id: string;
  title: string;
  body: string;
}

export const ABOUT_SECTIONS: AboutSectionItem[] = [
  {
    id: 'independente',
    title: 'Ferramenta independente e gratuita',
    body:
      'Projeto independente e de código aberto, sem qualquer vínculo, patrocínio ou endosso da Secretaria da Educação do Estado da Bahia (SEC-BA) ou do Governo do Estado da Bahia. Disponibilizado 100% gratuitamente.',
  },
  {
    id: 'privacidade',
    title: 'Privacidade e LGPD — processamento 100% local',
    body:
      'Todo o processamento ocorre localmente no seu navegador. A extensão não possui servidor próprio, não realiza telemetria e nunca envia ou armazena dados de estudantes, notas, frequências ou senhas fora do dispositivo (a senha opcional de auto-gravação fica apenas em memória RAM).',
  },
  {
    id: 'responsabilidade',
    title: 'Conferência pelo docente (as is)',
    body:
      'Software fornecido no estado em que se encontra (as is) como auxílio ao preenchimento. A conferência integral das notas, frequências e registros antes da gravação definitiva no diário de classe é de responsabilidade exclusiva do docente utilizador.',
  },
];

interface RuntimeManifestLike {
  getManifest?: () => { version?: string };
}

export function getExtensionVersion(fallback = '1.0.0'): string {
  try {
    const g = globalThis as {
      chrome?: { runtime?: RuntimeManifestLike };
      browser?: { runtime?: RuntimeManifestLike };
    };
    const v = g.chrome?.runtime?.getManifest?.()?.version ?? g.browser?.runtime?.getManifest?.()?.version;
    return typeof v === 'string' && v.trim() ? v.trim() : fallback;
  } catch {
    return fallback;
  }
}
