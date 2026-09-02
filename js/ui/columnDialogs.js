/* Column management dialogs: add, rename, and delete (which archives). */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});

  /**
   * Prompt for a column title in a small modal.
   * @param {{title?: string, initialTitle?: string, onSave: function}} options
   */
  function promptForColumnTitle({ title = 'New column', initialTitle = '', onSave }) {
    const utils = Kanban.utils;
    const modal = Kanban.modal;

    const input = utils.el('input', {
      class: 'input', required: 'required', maxlength: '60', value: initialTitle, placeholder: 'e.g. Reviewing',
    });
    const form = utils.el('form', { id: 'column-title-form' }, utils.field('Column name *', input));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) return;
      close();
      onSave(value);
    });

    const cancelBtn = utils.el('button', { class: 'btn', type: 'button', text: 'Cancel' });
    const saveBtn = utils.el('button', {
      class: 'btn btn-primary', type: 'submit', form: 'column-title-form', text: 'Save',
    });

    const close = modal.open({
      title,
      content: form,
      footer: utils.el('div', { class: 'modal-actions' }, cancelBtn, saveBtn),
    });
    cancelBtn.addEventListener('click', () => close());
  }

  /** Open the "new column" prompt and create the column on save. */
  function addColumnDialog() {
    promptForColumnTitle({
      title: 'New column',
      initialTitle: '',
      onSave: (title) => {
        Kanban.state.addColumn(title);
        Kanban.toast('Column added', 'success');
      },
    });
  }

  /** Open the rename prompt for an existing column. */
  function renameColumnDialog(column) {
    promptForColumnTitle({
      title: 'Rename column',
      initialTitle: column.title,
      onSave: (title) => {
        Kanban.state.renameColumn(column.id, title);
        Kanban.toast('Column renamed', 'success');
      },
    });
  }

  /**
   * Delete a column. Cards are never destroyed silently: the confirm dialog
   * explains that the column and its cards move to the archive (restorable).
   */
  async function archiveColumnDialog(column) {
    const modal = Kanban.modal;
    const cardCount = column.cardIds.length;
    const message = cardCount > 0
      ? `\u201c${column.title}\u201d and its ${cardCount} card${cardCount === 1 ? '' : 's'} will be moved to the archive. You can restore them later from the Archive panel.`
      : `\u201c${column.title}\u201d will be moved to the archive. You can restore it later from the Archive panel.`;

    const ok = await modal.confirmDialog({
      title: 'Delete column?',
      message,
      confirmLabel: 'Move to archive',
    });
    if (!ok) return;
    Kanban.state.archiveColumn(column.id);
    Kanban.toast('Column moved to archive', 'info');
  }

  Kanban.columnDialogs = { addColumnDialog, renameColumnDialog, archiveColumnDialog };
})(window);
