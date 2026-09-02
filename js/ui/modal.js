/* Generic modal dialog plus a Promise-based confirm dialog.
 *
 * Modals stack: opening a new one layers it above any open modal instead of
 * destroying it (e.g. "Delete permanently?" opens on top of the card editor,
 * and cancelling the confirmation keeps the editor visible). Only the
 * topmost modal reacts to Escape / overlay clicks. */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});
  const utils = Kanban.utils;

  let nextZIndex = 50; // base layer for the first modal, +1 per stacked modal

  /**
   * Open a modal dialog.
   * @param {{title: string, content: Node, footer?: Node, onClose?: function}} options
   *        `onClose` fires exactly once when the dialog closes by any means
   *        (button, Escape, or overlay click).
   * @returns {function} close() — closes this dialog (safe to call multiple times)
   */
  function open({ title, content, footer = null, onClose = null }) {
    const root = document.getElementById('modal-root');

    const closeBtn = utils.el('button', {
      class: 'icon-btn modal-close', type: 'button', text: '\u00d7', 'aria-label': 'Close dialog',
    });
    const dialog = utils.el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      utils.el('header', { class: 'modal-header' },
        utils.el('h2', { text: title }),
        closeBtn),
      utils.el('div', { class: 'modal-body' }, content),
      footer ? utils.el('footer', { class: 'modal-footer' }, footer) : null);
    const overlay = utils.el('div', { class: 'modal-overlay', style: `z-index:${++nextZIndex}` }, dialog);

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      if (onClose) onClose();
    }
    // Only the topmost modal reacts to Escape.
    function onKeydown(e) {
      if (e.key === 'Escape' && root.lastElementChild === overlay) close();
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close(); // click outside the dialog closes it
    });
    document.addEventListener('keydown', onKeydown);

    root.append(overlay);

    const focusable = dialog.querySelector('input, textarea, select, button:not(.modal-close)');
    if (focusable) focusable.focus();

    return close;
  }

  /**
   * Confirmation dialog. Resolves true when confirmed, false otherwise
   * (cancelling or dismissing via Escape/overlay both count as "no").
   * @param {{title: string, message: string, confirmLabel?: string, danger?: boolean}} options
   */
  function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = true }) {
    return new Promise((resolve) => {
      const cancelBtn = utils.el('button', { class: 'btn', type: 'button', text: 'Cancel' });
      const confirmBtn = utils.el('button', {
        class: danger ? 'btn btn-danger' : 'btn btn-primary',
        type: 'button',
        text: confirmLabel,
      });

      // onClose covers Escape / overlay-click dismissal; button handlers resolve first.
      const close = open({
        title,
        content: utils.el('p', { class: 'modal-message', text: message }),
        footer: utils.el('div', { class: 'modal-actions' }, cancelBtn, confirmBtn),
        onClose: () => resolve(false),
      });

      cancelBtn.addEventListener('click', () => { resolve(false); close(); });
      confirmBtn.addEventListener('click', () => { resolve(true); close(); });
    });
  }

  Kanban.modal = { open, confirmDialog };
})(window);
