/* Application state: the single source of truth for all board data.
 *
 * Shape:
 *   {
 *     columns:         [{ id, title, cardIds: [cardId] }],        // live columns, in order
 *     cards:           { [id]: Card },                            // every card (live + archived)
 *     labels:          [{ id, name, color }],                     // shared label palette
 *     archivedColumns: [{ id, title, cardIds, archivedAt }]       // soft-deleted columns
 *   }
 *
 * A Card is: { id, title, description, assignee, labelIds, columnId,
 *              archived, archivedAt, createdAt, updatedAt }
 *
 * Every mutation goes through an action below. Actions persist the state and
 * notify subscribers (the render layer), so UI code never mutates state directly.
 */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});
  const utils = Kanban.utils;
  const storage = Kanban.storage;

  let state = null;
  const listeners = new Set();

  function emit() {
    storage.saveBoard(state);
    listeners.forEach((fn) => fn(state));
  }

  /** First-launch board: default columns plus a few sample cards. */
  function defaultState() {
    const labels = JSON.parse(JSON.stringify(Kanban.DEFAULT_LABELS));
    const columns = Kanban.DEFAULT_COLUMN_TITLES.map((title) => ({
      id: utils.uid('col'),
      title,
      cardIds: [],
    }));
    const cards = {};

    function addSample(title, description, labelNames, columnTitle, assignee) {
      const col = columns.find((c) => c.title === columnTitle);
      const id = utils.uid('card');
      const now = Date.now();
      cards[id] = {
        id,
        title,
        description,
        assignee: assignee || '',
        labelIds: labels.filter((l) => labelNames.includes(l.name)).map((l) => l.id),
        columnId: col.id,
        archived: false,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      col.cardIds.push(id);
    }

    addSample('Plan the week', 'Break the week into small, concrete tasks and pick the top three.', ['Work'], 'To Do', 'You');
    addSample('Read 20 pages', 'Continue the book on the nightstand before bed.', ['Personal'], 'To Do');
    addSample('Fix the leaky faucet', 'Order a replacement washer while it is in stock.', ['Urgent'], 'In Progress');
    addSample('Book dentist appointment', 'Morning slot preferred; call after 9:00.', ['Personal'], 'Done');

    return { columns, cards, labels, archivedColumns: [] };
  }

  function findColumn(id) {
    return state.columns.find((c) => c.id === id) || null;
  }

  /** Remove a card from whichever live column currently lists it. */
  function detachCard(cardId) {
    state.columns.forEach((col) => {
      col.cardIds = col.cardIds.filter((id) => id !== cardId);
    });
  }

  const actions = {
    /* ---------------- lifecycle ---------------- */

    /** Load persisted board (or seed defaults), then notify subscribers. */
    init() {
      state = storage.loadBoard() || defaultState();
      emit();
    },

    getState() {
      return state;
    },

    /** Subscribe to every state change. Returns an unsubscribe function. */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /* ---------------- columns ---------------- */

    addColumn(title) {
      const col = { id: utils.uid('col'), title: (title || '').trim() || 'Untitled', cardIds: [] };
      state.columns.push(col);
      emit();
      return col.id;
    },

    renameColumn(id, title) {
      const col = findColumn(id);
      if (!col) return;
      const clean = (title || '').trim();
      if (clean) col.title = clean; // keep old name on empty input
      emit();
    },

    /** Move a column to `targetIndex` in the visible order. */
    moveColumn(id, targetIndex) {
      const from = state.columns.findIndex((c) => c.id === id);
      if (from === -1) return;
      const [col] = state.columns.splice(from, 1);
      const index = Math.max(0, Math.min(targetIndex, state.columns.length));
      state.columns.splice(index, 0, col);
      emit();
    },

    /** Soft-delete a column: it and all of its cards go to the archive. */
    archiveColumn(id) {
      const index = state.columns.findIndex((c) => c.id === id);
      if (index === -1) return;
      const [col] = state.columns.splice(index, 1);
      col.cardIds.forEach((cardId) => {
        const card = state.cards[cardId];
        if (card) {
          card.archived = true;
          card.archivedAt = Date.now();
        }
      });
      col.archivedAt = Date.now();
      state.archivedColumns.push(col);
      emit();
    },

    /** Put an archived column back and un-archive the cards that belong to it. */
    restoreColumn(id) {
      const index = state.archivedColumns.findIndex((c) => c.id === id);
      if (index === -1) return;
      const [col] = state.archivedColumns.splice(index, 1);
      delete col.archivedAt;
      state.columns.push(col);

      Object.values(state.cards).forEach((card) => {
        if (card.columnId === col.id && card.archived) {
          card.archived = false;
          card.archivedAt = null;
          if (!col.cardIds.includes(card.id)) col.cardIds.push(card.id);
        }
      });
      // Drop ids that no longer exist or were archived individually.
      col.cardIds = col.cardIds.filter((cardId) => state.cards[cardId] && !state.cards[cardId].archived);
      emit();
    },

    /** Hard-delete an archived column and every card still tied to it. */
    deleteColumnPermanently(id) {
      const index = state.archivedColumns.findIndex((c) => c.id === id);
      if (index === -1) return;
      const [col] = state.archivedColumns.splice(index, 1);
      Object.values(state.cards).forEach((card) => {
        if (card.columnId === col.id) delete state.cards[card.id];
      });
      emit();
    },

    /* ---------------- cards ---------------- */

    addCard(columnId, data) {
      const col = findColumn(columnId);
      if (!col) return null;
      const d = data || {};
      const id = utils.uid('card');
      const now = Date.now();
      state.cards[id] = {
        id,
        title: (d.title || '').trim(),
        description: (d.description || '').trim(),
        assignee: (d.assignee || '').trim(),
        labelIds: Array.isArray(d.labelIds) ? [...d.labelIds] : [],
        columnId: col.id,
        archived: false,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      col.cardIds.push(id);
      emit();
      return id;
    },

    updateCard(id, data) {
      const card = state.cards[id];
      if (!card) return;
      const d = data || {};
      const cleanTitle = (d.title !== undefined ? d.title : card.title).trim();
      if (!cleanTitle) return; // title is required; ignore empty saves
      card.title = cleanTitle;
      if (d.description !== undefined) card.description = d.description.trim();
      if (d.assignee !== undefined) card.assignee = d.assignee.trim();
      if (Array.isArray(d.labelIds)) card.labelIds = [...d.labelIds];
      card.updatedAt = Date.now();
      emit();
    },

    /**
     * Move a card to `toColumnId`. If `beforeCardId` is given and exists in the
     * target column, insert before it; otherwise append at the end.
     */
    moveCard(cardId, toColumnId, beforeCardId) {
      const card = state.cards[cardId];
      const target = findColumn(toColumnId);
      if (!card || !target || card.archived) return;
      if (beforeCardId === cardId) beforeCardId = null; // dropped onto itself

      detachCard(cardId);
      card.columnId = target.id;
      if (beforeCardId && target.cardIds.includes(beforeCardId)) {
        target.cardIds.splice(target.cardIds.indexOf(beforeCardId), 0, cardId);
      } else {
        target.cardIds.push(cardId);
      }
      emit();
    },

    /** Soft-delete a card: it stays in state.cards with archived = true. */
    archiveCard(cardId) {
      const card = state.cards[cardId];
      if (!card) return;
      card.archived = true;
      card.archivedAt = Date.now();
      detachCard(cardId);
      emit();
    },

    /** Restore an archived card to its original column (or a sensible fallback). */
    restoreCard(cardId) {
      const card = state.cards[cardId];
      if (!card || !card.archived) return;
      card.archived = false;
      card.archivedAt = null;

      let col = findColumn(card.columnId);
      if (!col) {
        // Original column is gone: fall back to the first live column,
        // creating a "To Do" column if the board has none at all.
        col = state.columns[0] || { id: utils.uid('col'), title: 'To Do', cardIds: [] };
        if (!state.columns.length) state.columns.push(col);
      }
      card.columnId = col.id;
      if (!col.cardIds.includes(cardId)) col.cardIds.push(cardId);
      emit();
    },

    deleteCardPermanently(cardId) {
      if (!state.cards[cardId]) return;
      detachCard(cardId);
      delete state.cards[cardId];
      emit();
    },

    /* ---------------- labels ---------------- */

    /** Add a label (or update the color of an existing one with the same name). */
    addLabel(name, color) {
      const clean = (name || '').trim();
      if (!clean) return null;
      const existing = state.labels.find((l) => utils.normalize(l.name) === utils.normalize(clean));
      if (existing) {
        if (color) existing.color = color;
        emit();
        return existing.id;
      }
      const label = { id: utils.uid('label'), name: clean, color: color || '#6b7280' };
      state.labels.push(label);
      emit();
      return label.id;
    },

    /* ---------------- selectors ---------------- */

    getCard(id) {
      return state.cards[id] || null;
    },

    getColumn(id) {
      return findColumn(id);
    },

    /** True when a column should show the completion indicator on its cards. */
    isDoneColumn(col) {
      return utils.normalize(col && col.title) === Kanban.DONE_COLUMN_TITLE;
    },

    /** Archived cards, most recently archived first. */
    archivedCardList() {
      return Object.values(state.cards)
        .filter((c) => c.archived)
        .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
    },

    /** Distinct assignee names across live cards, sorted. */
    liveAssignees() {
      const set = new Set();
      Object.values(state.cards).forEach((c) => {
        if (!c.archived && c.assignee) set.add(c.assignee);
      });
      return [...set].sort((a, b) => a.localeCompare(b));
    },
  };

  Kanban.state = actions;
})(window);
