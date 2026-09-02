/* Lightweight toast notifications for action feedback (add/save/archive/delete). */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});
  const utils = Kanban.utils;

  /**
   * Show a short-lived toast in the bottom-right corner.
   * @param {string} message text to display
   * @param {'info'|'success'|'danger'} type accent colour
   */
  function toast(message, type) {
    const root = document.getElementById('toast-root');
    if (!root) return;

    const node = utils.el('div', { class: `toast toast-${type || 'info'}`, role: 'status' }, message);
    root.append(node);

    // Fade in on the next frame so the transition runs.
    requestAnimationFrame(() => node.classList.add('visible'));

    setTimeout(() => {
      node.classList.remove('visible');
      setTimeout(() => node.remove(), 250);
    }, Kanban.TOAST_DURATION_MS);
  }

  Kanban.toast = toast;
})(window);
