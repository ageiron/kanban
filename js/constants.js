/* Global constants shared across the app. Keep magic values here, not in modules. */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});

  /** localStorage keys used by the app. */
  Kanban.STORAGE_KEYS = {
    BOARD: 'kanban.board.v1',
    THEME: 'kanban.theme',
  };

  /** A column whose title matches this (case-insensitive) is treated as "Done". */
  Kanban.DONE_COLUMN_TITLE = 'done';

  /** Labels available on first launch. Users can add more from the card editor. */
  Kanban.DEFAULT_LABELS = [
    { id: 'label_work', name: 'Work', color: '#3b82f6' },
    { id: 'label_personal', name: 'Personal', color: '#10b981' },
    { id: 'label_urgent', name: 'Urgent', color: '#ef4444' },
    { id: 'label_idea', name: 'Idea', color: '#f59e0b' },
  ];

  /** Columns created on first launch. */
  Kanban.DEFAULT_COLUMN_TITLES = ['To Do', 'In Progress', 'Done'];

  /** How long a toast stays visible before fading out (ms). */
  Kanban.TOAST_DURATION_MS = 2600;

  /** Delay between typing in the search box and re-filtering (ms). */
  Kanban.SEARCH_DEBOUNCE_MS = 120;

})(window);
