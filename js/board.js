/* Board rendering: rebuilds columns/cards from state on every change, plus all
   click/submit/keyboard interaction for the board area (event delegation). */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});

  function boardEl() { return document.getElementById('board'); }

  /* ---------------- top-level render ---------------- */

  /** Full re-render of everything state-dependent. Called on every state change. */
  function render() {
    renderBoard();
    if (Kanban.filtersBar) Kanban.filtersBar.render();
    if (Kanban.archivePanel) {
      Kanban.archivePanel.updateBadge();
      const panel = document.getElementById('archive-panel');
      if (panel && !panel.hidden) Kanban.archivePanel.render();
    }
  }

  function renderBoard() {
    const state = Kanban.state;
    const s = state.getState();
    const root = boardEl();
    root.innerHTML = '';

    if (!s.columns.length) {
      root.append(emptyBoardState());
      return;
    }
    s.columns.forEach((col) => root.append(renderColumn(col)));
  }

  /* ---------------- empty states ---------------- */

  function emptyBoardState() {
    const utils = Kanban.utils;
    const addBtn = utils.el('button', { class: 'btn btn-primary', type: 'button', text: 'Add a column' });
    addBtn.addEventListener('click', () => Kanban.columnDialogs.addColumnDialog());
    return utils.el('div', { class: 'board-empty' },
      utils.el('div', { class: 'board-empty-icon', text: '\ud83d\uddc2\ufe0f' }),
      utils.el('h2', { text: 'Your board is empty' }),
      utils.el('p', { class: 'muted', text: 'Create a column to start organizing your cards.' }),
      addBtn);
  }

  /* ---------------- columns & cards ---------------- */

  function renderColumn(col) {
    const utils = Kanban.utils;
    const state = Kanban.state;
    const filters = Kanban.filters;
    const s = state.getState();

    // Cards that exist, are live, and pass the current filters (in column order).
    const visibleIds = col.cardIds.filter((id) => {
      const card = s.cards[id];
      return card && !card.archived && filters.matches(card);
    });

    const renameBtn = utils.el('button', {
      class: 'icon-btn', type: 'button', text: '\u270e\ufe0f', title: 'Rename column',
      'aria-label': `Rename column ${col.title}`, 'data-action': 'rename-column',
    });
    const deleteBtn = utils.el('button', {
      class: 'icon-btn', type: 'button', text: '\ud83d\uddd1\ufe0f', title: 'Delete column (cards move to archive)',
      'aria-label': `Delete column ${col.title}`, 'data-action': 'archive-column',
    });

    const header = utils.el('header', { class: 'column-header', draggable: 'true', 'data-column-id': col.id },
      utils.el('h2', { class: 'column-title', text: col.title }),
      utils.el('span', {
        class: 'column-count',
        text: col.cardIds.length === visibleIds.length ? String(col.cardIds.length) : `${visibleIds.length}/${col.cardIds.length}`,
      }),
      utils.el('div', { class: 'column-actions' }, renameBtn, deleteBtn));

    const list = utils.el('div', { class: 'card-list', 'data-column-id': col.id });
    if (!col.cardIds.length) {
      list.append(utils.el('div', { class: 'empty-hint', text: 'No cards yet \u2014 add one below or drag a card here.' }));
    } else if (!visibleIds.length) {
      list.append(utils.el('div', { class: 'empty-hint', text: 'No cards match your filters.' }));
    } else {
      visibleIds.forEach((id) => list.append(renderCard(s.cards[id], col)));
    }

    const input = utils.el('input', {
      class: 'input', type: 'text', placeholder: 'Add a card\u2026', maxlength: '120', required: 'required',
    });
    const addForm = utils.el('form', { class: 'add-card', 'data-column-id': col.id },
      input,
      utils.el('button', { class: 'btn btn-primary', type: 'submit', text: 'Add' }));

    return utils.el('section', { class: 'column', 'data-column-id': col.id }, header, list, addForm);
  }

  function renderCard(card, col) {
    const utils = Kanban.utils;
    const state = Kanban.state;
    const s = state.getState();
    const done = state.isDoneColumn(col);

    const labels = (card.labelIds || [])
      .map((id) => s.labels.find((l) => l.id === id))
      .filter(Boolean);

    return utils.el('article', {
      class: 'card' + (done ? ' card--done' : ''),
      draggable: 'true',
      'data-card-id': card.id,
      tabindex: '0',
      'aria-label': `Card: ${card.title}`,
    },
      utils.el('div', { class: 'card-body' },
        utils.el('h3', { class: 'card-title', text: card.title }),
        card.description ? utils.el('p', { class: 'card-desc', text: card.description }) : null,
        labels.length ? utils.el('div', { class: 'card-labels' },
          labels.map((l) => utils.el('span', {
            class: 'label-chip label-chip--sm', style: `--chip:${l.color}`, title: l.name,
          }, utils.el('span', { class: 'label-dot' }), l.name))) : null,
        card.assignee ? utils.el('div', { class: 'card-assignee' },
          utils.el('span', { class: 'assignee-avatar', text: (card.assignee.trim().charAt(0) || '?').toUpperCase() }),
          card.assignee) : null),
      done ? utils.el('span', { class: 'done-badge', title: 'Completed (in Done column)', 'aria-label': 'Completed', text: '\u2713' }) : null,
      utils.el('button', {
        class: 'icon-btn card-menu-btn', type: 'button', text: '\u22ef',
        'aria-label': `Actions for ${card.title}`, 'data-action': 'card-menu',
      }));
  }

  /* ---------------- card actions menu (⋯) ---------------- */

  function closeCardMenu() {
    const menu = document.querySelector('.card-menu');
    if (!menu) return;
    if (typeof menu._cleanup === 'function') menu._cleanup();
    menu.remove();
  }

  function showCardMenu(cardId, anchorBtn) {
    const utils = Kanban.utils;
    const state = Kanban.state;
    const modal = Kanban.modal;
    closeCardMenu();

    const card = state.getCard(cardId);
    if (!card) return;

    const archiveBtn = utils.el('button', { class: 'menu-item', type: 'button', text: 'Archive' });
    archiveBtn.addEventListener('click', () => {
      closeCardMenu();
      state.archiveCard(cardId);
      Kanban.toast('Card archived', 'info');
    });

    const deleteBtn = utils.el('button', { class: 'menu-item menu-item--danger', type: 'button', text: 'Delete permanently' });
    deleteBtn.addEventListener('click', async () => {
      closeCardMenu();
      const ok = await modal.confirmDialog({
        title: 'Delete card?',
        message: `\u201c${card.title}\u201d will be deleted permanently. This cannot be undone.`,
        confirmLabel: 'Delete',
      });
      if (!ok) return;
      state.deleteCardPermanently(cardId);
      Kanban.toast('Card deleted', 'info');
    });

    const menu = utils.el('div', { class: 'card-menu', role: 'menu' }, archiveBtn, deleteBtn);
    document.body.append(menu);

    // Position near the anchor button, clamped to the viewport.
    const rect = anchorBtn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left - 120, window.innerWidth - 200))}px`;

    // Close on outside click or Escape. Deferred so the opening click doesn't close it.
    const onDocClick = (e) => { if (!menu.contains(e.target)) closeCardMenu(); };
    const onKeydown = (e) => { if (e.key === 'Escape') closeCardMenu(); };
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
    document.addEventListener('keydown', onKeydown);
    menu._cleanup = () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeydown);
    };
  }

  /* ---------------- events (delegated) ---------------- */

  function openCardEditor(cardId) {
    Kanban.cardModal.openCardModal({ card: Kanban.state.getCard(cardId) });
  }

  function handleAction(actionEl) {
    const state = Kanban.state;
    const action = actionEl.dataset.action;

    if (action === 'rename-column') {
      const colEl = actionEl.closest('.column');
      const col = state.getColumn(colEl.dataset.columnId);
      if (col) Kanban.columnDialogs.renameColumnDialog(col);
    } else if (action === 'archive-column') {
      const colEl = actionEl.closest('.column');
      const col = state.getColumn(colEl.dataset.columnId);
      if (col) Kanban.columnDialogs.archiveColumnDialog(col);
    } else if (action === 'card-menu') {
      const cardEl = actionEl.closest('.card');
      showCardMenu(cardEl.dataset.cardId, actionEl);
    }
  }

  function init() {
    const root = boardEl();

    // Clicks: action buttons first, then "open card editor" as the fallback.
    root.addEventListener('click', (e) => {
      const actionEl = e.target.closest ? e.target.closest('[data-action]') : null;
      if (actionEl) { handleAction(actionEl); return; }
      const cardEl = e.target.closest ? e.target.closest('.card') : null;
      if (cardEl) openCardEditor(cardEl.dataset.cardId);
    });

    // Quick-add forms at the bottom of each column.
    root.addEventListener('submit', (e) => {
      const form = e.target && e.target.classList ? e.target.closest('.add-card') : null;
      if (!form) return;
      e.preventDefault();
      const input = form.querySelector('input');
      const title = input.value.trim();
      if (!title) return;
      const columnId = form.dataset.columnId;
      Kanban.state.addCard(columnId, { title }); // re-renders the board (old nodes are gone)
      Kanban.toast('Card added', 'success');
      // Re-focus the freshly rendered input so several cards can be added in a row.
      const freshForm = root.querySelector(`.add-card[data-column-id="${columnId}"]`);
      if (freshForm) freshForm.querySelector('input').focus();
    });

    // Keyboard: Enter on a focused card opens its editor.
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('card')) {
        e.preventDefault();
        openCardEditor(e.target.dataset.cardId);
      }
    });

    // Re-render on every state change.
    Kanban.state.subscribe(() => render());
  }

  Kanban.board = { init, render };
})(window);
