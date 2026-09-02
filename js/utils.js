/* Small shared helpers: id generation, DOM element builder, debounce, formatting. */
(function (global) {
  'use strict';

  const Kanban = (global.Kanban = global.Kanban || {});

  /** Generate a short unique id with a readable prefix, e.g. "card_m3k2j1ab9c". */
  function uid(prefix) {
    return `${prefix || 'id'}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Create a DOM element with attributes/properties and children.
   *
   * el('div', { class: 'x', onClick: fn }, child1, ['a', 'b'], 'text', null)
   *
   * - `class`, `text` are treated as properties.
   * - keys starting with `on` (e.g. `onClick`) attach event listeners.
   * - `value` / `checked` / `disabled` are set as element properties.
   * - everything else is set as an attribute.
   * - children may be elements, strings/numbers, arrays (flattened), or
   *   null/undefined/false (skipped).
   */
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === null || value === undefined) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'value') node.value = value;
      else if (key === 'checked') node.checked = value;
      else if (key === 'disabled') node.disabled = value;
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        node.setAttribute(key, String(value));
      }
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      if (Array.isArray(child)) { appendChildren(node, child); continue; }
      if (child.nodeType !== undefined) node.appendChild(child);
      else node.appendChild(document.createTextNode(String(child)));
    }
  }

  /** Wrap a label and a control in the standard vertical field layout. */
  function field(labelText, control) {
    return el('div', { class: 'field' },
      el('span', { class: 'field-label', text: labelText }),
      control);
  }

  /** Return a debounced version of fn (trailing edge). */
  function debounce(fn, waitMs) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), waitMs);
    };
  }

  /** Case-insensitive trim for comparisons. */
  function normalize(str) {
    return (str || '').trim().toLowerCase();
  }

  /** Human-friendly date, e.g. "Jan 5, 2025". */
  function formatDate(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString();
  }

  Kanban.utils = { uid, el, field, debounce, normalize, formatDate };
})(window);
