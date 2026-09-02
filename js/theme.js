/* Dark/light theme: applies the preference to <html data-theme>, persists it,
   and falls back to the OS preference on first launch. */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});

  /** Icon shown while in this theme (= what clicking will switch TO). */
  const THEME_ICONS = { light: '\u263e\ufe0f', dark: '\u2600\ufe0f' }; // moon / sun

  function currentTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = THEME_ICONS[theme];
      const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
      btn.title = label;
      btn.setAttribute('aria-label', label);
    }
  }

  function init() {
    let theme = Kanban.storage.loadTheme();
    if (theme !== 'light' && theme !== 'dark') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }
    apply(theme);

    document.getElementById('theme-toggle').addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      apply(next);
      Kanban.storage.saveTheme(next);
    });
  }

  Kanban.theme = { init };
})(window);
