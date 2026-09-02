/* App entry point: boots every module in dependency order. */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});

  function init() {
    Kanban.state.init();        // load persisted board (or seed defaults) + subscribe renderers
    Kanban.theme.init();        // apply saved/OS theme preference
    Kanban.board.init();        // wire board events, subscribes to state changes
    Kanban.filtersBar.init();   // wire search / assignee / label filter controls
    Kanban.archivePanel.init(); // wire archive panel open/close
    Kanban.dnd.init();          // wire drag-and-drop for cards and columns

    Kanban.board.render();      // first paint (state.init already emitted before subscribers existed)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
