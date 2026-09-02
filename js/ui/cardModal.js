/* Card editor modal: create or edit a card's title, description, assignee and labels. */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});

  /**
   * Open the card editor.
   * @param {{card?: object|null, columnId?: string}} options
   *        - with `card`: edit mode for an existing card
   *        - with `columnId`: create a new card in that column
   */
  function openCardModal({ card = null, columnId = null } = {}) {
    const utils = Kanban.utils;
    const state = Kanban.state;
    const modal = Kanban.modal;

    const isEdit = Boolean(card);
    const selectedLabels = new Set((card && card.labelIds) || []);

    /* ----- label picker (rebuilt when a new label is added) ----- */
    const labelsBody = utils.el('div', { class: 'label-options' });

    function renderLabelOptions() {
      labelsBody.innerHTML = '';
      state.getState().labels.forEach((label) => {
        labelsBody.append(utils.el('label', { class: 'label-option' },
          utils.el('input', { type: 'checkbox', 'data-label-id': label.id, checked: selectedLabels.has(label.id) }),
          utils.el('span', { class: 'label-chip', style: `--chip:${label.color}` },
            utils.el('span', { class: 'label-dot' }),
            label.name)));
      });
    }
    renderLabelOptions();

    labelsBody.addEventListener('change', (e) => {
      const input = e.target.closest ? e.target.closest('input[data-label-id]') : null;
      if (!input) return;
      if (input.checked) selectedLabels.add(input.dataset.labelId);
      else selectedLabels.delete(input.dataset.labelId);
    });

    /* ----- form ----- */
    const titleInput = utils.el('input', {
      class: 'input', name: 'title', required: 'required', maxlength: '120',
      value: card ? card.title : '', placeholder: 'e.g. Pay the electric bill',
    });
    const descriptionInput = utils.el('textarea', {
      class: 'input', name: 'description', rows: '4', placeholder: 'Optional notes\u2026',
    }, card ? card.description : '');
    const assigneeInput = utils.el('input', {
      class: 'input', name: 'assignee', maxlength: '60',
      value: card ? card.assignee : '', placeholder: 'e.g. Alex (optional)',
    });

    const form = utils.el('form', { class: 'card-form', id: 'card-editor-form' },
      utils.field('Title *', titleInput),
      utils.field('Description', descriptionInput),
      utils.field('Assignee', assigneeInput),
      utils.el('div', { class: 'field' },
        utils.el('span', { class: 'field-label', text: 'Labels' }),
        labelsBody,
        state.getState().labels.length ? null : utils.el('p', {
          class: 'muted', text: 'No labels yet — add one from the top bar.',
        })));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }

      const data = {
        title,
        description: descriptionInput.value,
        assignee: assigneeInput.value,
        labelIds: [...selectedLabels],
      };
      if (isEdit) {
        state.updateCard(card.id, data);
        Kanban.toast('Card saved', 'success');
      } else {
        state.addCard(columnId, data);
        Kanban.toast('Card added', 'success');
      }
      close();
    });

    /* ----- footer buttons ----- */
    const cancelBtn = utils.el('button', { class: 'btn', type: 'button', text: 'Cancel' });
    const saveBtn = utils.el('button', {
      class: 'btn btn-primary', type: 'submit', form: 'card-editor-form', text: isEdit ? 'Save changes' : 'Add card',
    });

    let deleteBtn = null;
    if (isEdit) {
      deleteBtn = utils.el('button', { class: 'btn btn-danger', type: 'button', text: 'Delete permanently' });
      deleteBtn.addEventListener('click', async () => {
        const ok = await modal.confirmDialog({
          title: 'Delete card?',
          message: `\u201c${card.title}\u201d will be deleted permanently. This cannot be undone.`,
          confirmLabel: 'Delete',
        });
        if (!ok) return;
        state.deleteCardPermanently(card.id);
        Kanban.toast('Card deleted', 'info');
        close();
      });
    }

    const close = modal.open({
      title: isEdit ? 'Edit card' : 'New card',
      content: form,
      footer: utils.el('div', { class: 'modal-actions' }, deleteBtn, cancelBtn, saveBtn),
    });
    cancelBtn.addEventListener('click', () => close());
  }

  Kanban.cardModal = { openCardModal };
})(window);
