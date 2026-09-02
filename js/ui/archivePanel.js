/* Archive slide-over panel: lists archived columns and cards with restore /
   permanent-delete actions, plus the badge count on the header button. */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});

  let isOpen = false;

  function panelEl() { return document.getElementById('archive-panel'); }
  function contentEl() { return document.getElementById('archive-content'); }

  /** Total number of archived items (columns + cards). */
  function totalCount() {
    const s = Kanban.state.getState();
    if (!s) return 0;
    return s.archivedColumns.length + Object.values(s.cards).filter((c) => c.archived).length;
  }

  /** Keep the badge on the header "Archive" button in sync. */
  function updateBadge() {
    const badge = document.getElementById('archive-badge');
    if (!badge) return;
    const n = totalCount();
    badge.textContent = String(n);
    badge.hidden = n === 0;
  }

  function toggle() {
    isOpen = !isOpen;
    panelEl().hidden = !isOpen;
    if (isOpen) render();
  }

  /* ---------------- rendering ---------------- */

  function emptyNote(text) {
    return Kanban.utils.el('p', { class: 'archive-empty', text });
  }

  function itemRow(mainNode, buttons) {
    const utils = Kanban.utils;
    return utils.el('div', { class: 'archive-item' }, mainNode, utils.el('div', { class: 'archive-item-actions' }, ...buttons));
  }

  function render() {
    const utils = Kanban.utils;
    const state = Kanban.state;
    const modal = Kanban.modal;
    const s = state.getState();
    const content = contentEl();
    content.innerHTML = '';

    /* ----- archived columns (most recent first) ----- */
    content.append(utils.el('h3', { class: 'archive-section-title', text: 'Columns' }));
    if (!s.archivedColumns.length) {
      content.append(emptyNote('No archived columns.'));
    } else {
      s.archivedColumns.slice().reverse().forEach((col) => {
        const cardCount = col.cardIds.filter((id) => s.cards[id]).length;
        const restoreBtn = utils.el('button', { class: 'btn btn-primary', type: 'button', text: 'Restore' });
        restoreBtn.addEventListener('click', () => {
          state.restoreColumn(col.id);
          Kanban.toast('Column restored', 'success');
          render();
        });
        const deleteBtn = utils.el('button', { class: 'btn btn-danger-ghost', type: 'button', text: 'Delete' });
        deleteBtn.addEventListener('click', async () => {
          const ok = await modal.confirmDialog({
            title: 'Delete column permanently?',
            message: `\u201c${col.title}\u201d and its ${cardCount} card${cardCount === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.`,
            confirmLabel: 'Delete',
          });
          if (!ok) return;
          state.deleteColumnPermanently(col.id);
          Kanban.toast('Column deleted', 'info');
          render();
        });

        content.append(itemRow(
          utils.el('div', { class: 'archive-item-main' },
            utils.el('strong', { text: col.title }),
            utils.el('span', { class: 'muted', text: `${cardCount} card${cardCount === 1 ? '' : 's'} \u00b7 archived ${utils.formatDate(col.archivedAt)}` })),
          [restoreBtn, deleteBtn]));
      });
    }

    /* ----- archived cards (most recent first) ----- */
    content.append(utils.el('h3', { class: 'archive-section-title', text: 'Cards' }));
    const archivedCards = state.archivedCardList();
    if (!archivedCards.length) {
      content.append(emptyNote('No archived cards.'));
    } else {
      archivedCards.forEach((card) => {
        const liveCol = state.getColumn(card.columnId);
        const archivedCol = s.archivedColumns.find((c) => c.id === card.columnId);
        const colName = liveCol ? liveCol.title : (archivedCol ? `${archivedCol.title} (archived)` : 'Unknown column');

        const restoreBtn = utils.el('button', { class: 'btn btn-primary', type: 'button', text: 'Restore' });
        restoreBtn.addEventListener('click', () => {
          state.restoreCard(card.id);
          Kanban.toast('Card restored', 'success');
          render();
        });
        const deleteBtn = utils.el('button', { class: 'btn btn-danger-ghost', type: 'button', text: 'Delete' });
        deleteBtn.addEventListener('click', async () => {
          const ok = await modal.confirmDialog({
            title: 'Delete card permanently?',
            message: `\u201c${card.title}\u201d will be permanently deleted. This cannot be undone.`,
            confirmLabel: 'Delete',
          });
          if (!ok) return;
          state.deleteCardPermanently(card.id);
          Kanban.toast('Card deleted', 'info');
          render();
        });

        content.append(itemRow(
          utils.el('div', { class: 'archive-item-main' },
            utils.el('strong', { text: card.title }),
            utils.el('span', { class: 'muted', text: `${colName} \u00b7 archived ${utils.formatDate(card.archivedAt)}` })),
          [restoreBtn, deleteBtn]));
      });
    }
  }

  function init() {
    document.getElementById('archive-btn').addEventListener('click', toggle);
    document.getElementById('archive-close').addEventListener('click', toggle);
    document.addEventListener('keydown', (e) => {
      // Ignore Escape while a modal is open — the modal handles it itself.
      const modalRoot = document.getElementById('modal-root');
      if (e.key === 'Escape' && isOpen && !(modalRoot && modalRoot.children.length)) toggle();
    });
  }

  Kanban.archivePanel = { init, toggle, render, updateBadge };
})(window);
