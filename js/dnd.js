/* Drag-and-drop using the native HTML5 DnD API (no library needed).
 *
 * Two drag kinds, tracked in a module-level `drag` variable because
 * dataTransfer payloads are not readable during dragover:
 *   - card:   dragged from .card, dropped into any .column's card list.
 *             A dashed placeholder shows the insertion point (between or within columns).
 *   - column: dragged from .column-header, reordered via a vertical indicator bar.
 */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});
  const utils = Kanban.utils;

  let drag = null;        // { kind: 'card' | 'column', id } while dragging, else null
  let placeholder = null; // dashed insertion box for card drags
  let indicator = null;   // vertical bar for column drags

  function boardEl() { return document.getElementById('board'); }

  function ensurePlaceholder(height) {
    if (!placeholder) placeholder = utils.el('div', { class: 'dnd-placeholder' });
    if (height) placeholder.style.height = `${height}px`;
    return placeholder;
  }

  function ensureIndicator() {
    if (!indicator) indicator = utils.el('div', { class: 'column-drop-indicator' });
    return indicator;
  }

  /** Remove all drag visuals and reset the drag state. Safe to call repeatedly. */
  function cleanup() {
    if (placeholder) { placeholder.remove(); placeholder = null; }
    if (indicator) { indicator.remove(); indicator = null; }
    document.querySelectorAll('.card.dragging').forEach((c) => c.classList.remove('dragging'));
    drag = null;
  }

  /* ---------------- handlers ---------------- */

  function onDragStart(e) {
    const target = e.target;
    if (!target || !target.closest) return;

    const cardEl = target.closest('.card');
    const headerEl = cardEl ? null : target.closest('.column-header');
    e.dataTransfer.effectAllowed = 'move';

    if (cardEl) {
      drag = { kind: 'card', id: cardEl.dataset.cardId };
      // Firefox requires data to be set for the drag to start.
      e.dataTransfer.setData('text/plain', cardEl.dataset.cardId);
      cardEl.classList.add('dragging');
      ensurePlaceholder(cardEl.offsetHeight);
    } else if (headerEl) {
      drag = { kind: 'column', id: headerEl.dataset.columnId };
      e.dataTransfer.setData('text/plain', headerEl.dataset.columnId);
      ensureIndicator();
    } else {
      e.preventDefault(); // not a draggable region we handle
    }
  }

  /** First card (excluding the one being dragged) whose midpoint is below y. */
  function nextVisibleCard(list, y) {
    const cards = Array.from(list.querySelectorAll('.card'))
      .filter((c) => !c.classList.contains('dragging'));
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) return card;
    }
    return null;
  }

  function onDragOver(e) {
    if (!drag || !e.target || !e.target.closest) return;
    e.preventDefault(); // required to allow dropping
    e.dataTransfer.dropEffect = 'move';

    if (drag.kind === 'card') {
      const colEl = e.target.closest('.column');
      if (!colEl) return;
      const list = colEl.querySelector('.card-list');
      if (!list) return;

      const ph = ensurePlaceholder();
      const afterCard = nextVisibleCard(list, e.clientY);
      const hint = list.querySelector('.empty-hint');
      if (afterCard) list.insertBefore(ph, afterCard);
      else if (hint) list.insertBefore(ph, hint); // keep the placeholder above the hint text
      else list.append(ph);
    } else {
      // Column reorder: place the indicator before the first column whose
      // horizontal midpoint is to the right of the cursor.
      const board = boardEl();
      const cols = Array.from(board.querySelectorAll(':scope > .column'))
        .filter((c) => c.dataset.columnId !== drag.id);
      const ind = ensureIndicator();
      const afterCol = cols.find((c) => {
        const rect = c.getBoundingClientRect();
        return e.clientX < rect.left + rect.width / 2;
      });
      if (afterCol) board.insertBefore(ind, afterCol);
      else board.append(ind);
    }
  }

  function onDrop(e) {
    if (!drag || !e.target || !e.target.closest) return;
    e.preventDefault();

    if (drag.kind === 'card') {
      const colEl = e.target.closest('.column');
      if (!colEl) { cleanup(); return; }

      // Insertion point: the first non-dragging card after the placeholder.
      let beforeCardId = null;
      if (placeholder && placeholder.parentNode) {
        let node = placeholder.nextElementSibling;
        while (node) {
          if (node.classList && node.classList.contains('card') && !node.classList.contains('dragging')) {
            beforeCardId = node.dataset.cardId;
            break;
          }
          node = node.nextElementSibling;
        }
      }

      const cardId = drag.id;
      const toColumnId = colEl.dataset.columnId;
      cleanup();
      Kanban.state.moveCard(cardId, toColumnId, beforeCardId); // triggers re-render
    } else {
      // Column reorder: count columns (excluding the dragged one) that appear
      // before the indicator in the board's child order.
      const board = boardEl();
      let index = 0;
      for (const child of Array.from(board.children)) {
        if (child === indicator) break;
        if (child.classList && child.classList.contains('column') && child.dataset.columnId !== drag.id) {
          index += 1;
        }
      }
      const columnId = drag.id;
      cleanup();
      Kanban.state.moveColumn(columnId, index); // triggers re-render
    }
  }

  function onDragEnd() {
    // Fires for every drag (drop or cancel). State was already updated on drop.
    cleanup();
  }

  function init() {
    const board = boardEl();
    board.addEventListener('dragstart', onDragStart);
    board.addEventListener('dragover', onDragOver);
    board.addEventListener('drop', onDrop);
    board.addEventListener('dragend', onDragEnd);
  }

  Kanban.dnd = { init };
})(window);
