/* Search & filter state plus the matching logic.
 *
 * Filters combine with AND between categories and OR within a category:
 *   (search matches title OR description)
 *   AND (card has ANY of the selected labels, when any are selected)
 *   AND (assignee equals the selection, when one is selected)
 */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});

  const filters = {
    search: '',            // free text, matched against title + description
    labelIds: new Set(),   // selected label ids (OR within the set)
    assignee: '',          // exact assignee name ('' means "all")
  };

  /** True when any filter is active. */
  function isActive() {
    return filters.search.trim() !== '' || filters.labelIds.size > 0 || filters.assignee !== '';
  }

  /** Does a card pass the current filters? */
  function matches(card) {
    const term = filters.search.trim().toLowerCase();
    const title = (card.title || '').toLowerCase();
    const description = (card.description || '').toLowerCase();
    if (term && !(title.includes(term) || description.includes(term))) {
      return false;
    }
    const cardLabelIds = Array.isArray(card.labelIds) ? card.labelIds : [];
    if (filters.labelIds.size > 0 && !cardLabelIds.some((id) => filters.labelIds.has(id))) {
      return false;
    }
    if (filters.assignee !== '' && card.assignee !== filters.assignee) {
      return false;
    }
    return true;
  }

  /** Merge a partial update into the filter state. */
  function set(patch) {
    Object.assign(filters, patch);
  }

  function clear() {
    filters.search = '';
    filters.labelIds = new Set();
    filters.assignee = '';
  }

  function toggleLabel(id) {
    if (filters.labelIds.has(id)) filters.labelIds.delete(id);
    else filters.labelIds.add(id);
  }

  Kanban.filters = { get: () => filters, isActive, matches, set, clear, toggleLabel };
})(window);
