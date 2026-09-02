/* Persistence layer: reads/writes board data and theme to localStorage.
   All access is wrapped in try/catch so private-browsing or quota errors
   degrade gracefully instead of crashing the app. */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});
  const STORAGE_KEYS = Kanban.STORAGE_KEYS;

  /** Minimal shape check so a corrupted payload falls back to a fresh board. */
  function isValidBoard(data) {
    return Boolean(
      data && typeof data === 'object' &&
      Array.isArray(data.columns) &&
      data.cards !== null && typeof data.cards === 'object' &&
      Array.isArray(data.labels) &&
      Array.isArray(data.archivedColumns)
    );
  }

  Kanban.storage = {
    saveBoard(state) {
      try {
        localStorage.setItem(STORAGE_KEYS.BOARD, JSON.stringify(state));
      } catch (err) {
        console.error('Kanban: could not save board to localStorage', err);
      }
    },

    /** @returns {object|null} the stored board state, or null if absent/invalid. */
    loadBoard() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.BOARD);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return isValidBoard(data) ? data : null;
      } catch (err) {
        console.error('Kanban: could not load board from localStorage', err);
        return null;
      }
    },

    saveTheme(theme) {
      try {
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
      } catch (err) {
        /* non-fatal */
      }
    },

    /** @returns {'light'|'dark'|null} the stored theme preference. */
    loadTheme() {
      try {
        return localStorage.getItem(STORAGE_KEYS.THEME);
      } catch (err) {
        return null;
      }
    },
  };
})(window);
