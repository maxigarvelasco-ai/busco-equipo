import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const UIContext = createContext(null);

const DICTIONARY = {
  es: {
    feed_title: '¿Tenés ganas de jugar?',
    feed_subtitle: 'Encontrá partidos, torneos o un club y sumate.',
    filters: 'Filtros',
    courts: 'Canchas',
    global_cta: 'Me faltan jugadores',
    profile: 'Perfil',
    account: 'Cuenta',
    requests: 'Solicitudes',
    notifications: 'Notificaciones',
    search_placeholder: 'Buscar perfiles, clubes o canchas',
    search_empty: 'Empezá a escribir para buscar.',
    searching: 'Buscando...',
    no_results: 'No encontramos resultados con ese texto',
    view: 'Ver',
    message: 'Mensaje',
    contact: 'Contacto',
    added: 'Agregado',
    save_in_progress: 'Guardando...',
    menu: 'Menu',
    app_policies: 'Explicacion y politicas',
    send_suggestion: 'Enviar sugerencia',
    dark_mode: 'Tema oscuro',
    light_mode: 'Tema claro',
    language: 'Idioma',
    logout: 'Salir',
    suggestion_title: 'Enviar sugerencia',
    suggestion_placeholder: 'Contanos que mejorarias en la app...',
    send: 'Enviar',
    cancel: 'Cancelar',
    suggestion_sent: 'Sugerencia enviada',
    suggestion_error: 'No se pudo enviar la sugerencia',
    join: 'Quiero sumarme',
  },
  en: {
    feed_title: 'Want to play?',
    feed_subtitle: 'Find matches, tournaments or a club and join in.',
    filters: 'Filters',
    courts: 'Courts',
    global_cta: 'Need more players',
    profile: 'Profile',
    account: 'Account',
    requests: 'Requests',
    notifications: 'Notifications',
    search_placeholder: 'Search profiles, clubs or venues',
    search_empty: 'Start typing to search.',
    searching: 'Searching...',
    no_results: 'No results found',
    view: 'View',
    message: 'Message',
    contact: 'Contact',
    added: 'Added',
    save_in_progress: 'Saving...',
    menu: 'Menu',
    app_policies: 'App info and policies',
    send_suggestion: 'Send suggestion',
    dark_mode: 'Dark theme',
    light_mode: 'Light theme',
    language: 'Language',
    logout: 'Log out',
    suggestion_title: 'Send suggestion',
    suggestion_placeholder: 'Tell us what you would improve in the app...',
    send: 'Send',
    cancel: 'Cancel',
    suggestion_sent: 'Suggestion sent',
    suggestion_error: 'Could not send suggestion',
    join: 'I want to join',
  },
  pt: {
    feed_title: 'Quer jogar?',
    feed_subtitle: 'Encontre partidas, torneios ou um clube e participe.',
    filters: 'Filtros',
    courts: 'Quadras',
    global_cta: 'Faltam jogadores',
    profile: 'Perfil',
    account: 'Conta',
    requests: 'Solicitacoes',
    notifications: 'Notificacoes',
    search_placeholder: 'Buscar perfis, clubes ou quadras',
    search_empty: 'Comece a digitar para buscar.',
    searching: 'Buscando...',
    no_results: 'Nao encontramos resultados',
    view: 'Ver',
    message: 'Mensagem',
    contact: 'Contato',
    added: 'Adicionado',
    save_in_progress: 'Salvando...',
    menu: 'Menu',
    app_policies: 'Explicacao e politicas',
    send_suggestion: 'Enviar sugestao',
    dark_mode: 'Tema escuro',
    light_mode: 'Tema claro',
    language: 'Idioma',
    logout: 'Sair',
    suggestion_title: 'Enviar sugestao',
    suggestion_placeholder: 'Conte o que melhoraria no app...',
    send: 'Enviar',
    cancel: 'Cancelar',
    suggestion_sent: 'Sugestao enviada',
    suggestion_error: 'Nao foi possivel enviar a sugestao',
    join: 'Quero participar',
  },
};

export function UIProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem('be_theme');
    return stored === 'light' ? 'light' : 'dark';
  });

  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'es';
    const stored = window.localStorage.getItem('be_language');
    return ['es', 'en', 'pt'].includes(stored) ? stored : 'es';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('light-theme', theme === 'light');
    window.localStorage.setItem('be_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    window.localStorage.setItem('be_language', language);
  }, [language]);

  const value = useMemo(() => {
    const langDict = DICTIONARY[language] || DICTIONARY.es;
    const t = (key) => langDict[key] || DICTIONARY.es[key] || key;

    return {
      theme,
      setTheme,
      toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
      language,
      setLanguage,
      t,
    };
  }, [theme, language]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
