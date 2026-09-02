/* Filter bar controls: search box, assignee dropdown, label chips, clear button.
   The static inputs live in index.html; this module wires events and rebuilds
   the dynamic parts (label chips, assignee options, match count) on each render. */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});

  function init() {
    const utils = Kanban.utils;
    const filters = Kanban.filters;

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', utils.debounce(() => {
      filters.set({ search: searchInput.value });
      Kanban.board.render();
    }, Kanban.SEARCH_DEBOUNCE_MS));

    document.getElementById('clear-filters').addEventListener('click', () => {
      filters.clear();
      searchInput.value = '';
      document.getElementById('assignee-filter').value = '';
      Kanban.board.render();
    });

    document.getElementById('assignee-filter').addEventListener('change', (e) => {
      filters.set({ assignee: e.target.value });
      Kanban.board.render();
    });

    // Label chips are rebuilt on every render, so use delegation.
    document.getElementById('label-chips').addEventListener('click', (e) => {
      const chip = e.target.closest ? e.target.closest('[data-label-id]') : null;
      if (!chip) return;
      filters.toggleLabel(chip.dataset.labelId);
      Kanban.board.render();
    });

    // Global "new label" form, next to the filter chips.
    const newLabelName = document.getElementById('new-label-name');
    const newLabelColor = document.getElementById('new-label-color');
    document.getElementById('new-label-add').addEventListener('click', () => {
      const id = Kanban.state.addLabel(newLabelName.value, newLabelColor.value);
      if (!id) { newLabelName.focus(); return; } // empty name — ignore
      newLabelName.value = '';
      Kanban.board.render();
    });
  }

  /** Rebuild dynamic filter controls and the "X of Y cards" indicator. */
  function render() {
    const utils = Kanban.utils;
    const state = Kanban.state;
    const filters = Kanban.filters;
    const s = state.getState();
    const f = filters.get();

    /* ----- label chips (toggle to filter) ----- */
    const chipRoot = document.getElementById('label-chips');
    chipRoot.innerHTML = '';
    s.labels.forEach((label) => {
      const active = f.labelIds.has(label.id);
      chipRoot.append(utils.el('button', {
        class: 'label-chip filter-chip' + (active ? ' is-active' : ''),
        type: 'button',
        'data-label-id': label.id,
        title: `Filter by ${label.name}`,
        style: `--chip:${label.color}`,
      }, utils.el('span', { class: 'label-dot' }), label.name));
    });

    /* ----- assignee dropdown (built from live cards) ----- */
    const select = document.getElementById('assignee-filter');
    const assignees = state.liveAssignees();
    select.innerHTML = '';
    select.append(utils.el('option', { value: '', text: 'All assignees' }));
    assignees.forEach((name) => select.append(utils.el('option', { value: name, text: name })));
    // If the selected assignee no longer exists on any live card, drop the filter.
    if (f.assignee !== '' && !assignees.includes(f.assignee)) filters.set({ assignee: '' });
    select.value = f.assignee;

    /* ----- clear button + match count ----- */
    document.getElementById('clear-filters').hidden = !filters.isActive();

    const liveCards = Object.values(s.cards).filter((c) => !c.archived);
    const matched = liveCards.filter((c) => filters.matches(c)).length;
    const countEl = document.getElementById('match-count');
    if (filters.isActive()) {
      countEl.hidden = false;
      countEl.textContent = `${matched} of ${liveCards.length} cards shown`;
    } else {
      countEl.hidden = true;
    }
  }

  Kanban.filtersBar = { init, render };
})(window);
