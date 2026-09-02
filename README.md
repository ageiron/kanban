# Kanban — Personal Task Board

A small, polished Kanban board for personal task management. Built with **vanilla HTML, CSS and JavaScript only** — no frameworks, no build step, no backend. All data is stored in your browser's `localStorage`.

## How to run

There is nothing to install or compile. Pick either option:

1. **Open the file directly**
   Double-click `index.html` (or drag it into a browser tab). That's it.

2. **Serve the folder** (optional, e.g. if your browser restricts `file://`)
   ```bash
   # from this directory, with any static server:
   python -m http.server 8000     # then open http://localhost:8000
   # or: npx serve .
   ```

Works in any modern evergreen browser (Chrome/Edge, Firefox, Safari).

## Features

### Board & columns
- Starts with **To Do / In Progress / Done** columns and a few sample cards.
- **Add** columns (empty-board state button or the "New column" flow), **rename** them (✎ on the column header), **reorder** by dragging the column header, and **delete** (🗑).
- **Deleting a column never destroys its cards.** A confirmation dialog explains that the column *and all of its cards* are moved to the archive. Restoring the column brings its cards back with it.

### Cards
- Create via the "Add a card…" input at the bottom of any column (Enter or Add button; focus stays for rapid entry).
- Click a card (or focus it and press Enter) to open the editor modal:
  - **Title** (required), **Description** (plain textarea), **Assignee** (optional name), and one or more colour-coded **Labels**.
  - New labels can be created inline in the editor with any name + colour; they are shared across all cards and filters.
- Cards in a column titled **"Done"** (case-insensitive) show a green ✓ completion badge. Rename a column to "Done" and its cards get the indicator too.
- The **⋯** button on each card offers *Archive* or *Delete permanently*.

### Drag & drop
- Drag cards **between columns** and **reorder within a column** — a dashed placeholder shows exactly where the card will land (native HTML5 DnD, no library).
- Drag **column headers** to reorder columns — a vertical indicator bar shows the insertion point.

### Archive
- The **Archive** button in the top bar opens a slide-over panel with two sections: archived *columns* and archived *cards*, most recent first.
- Every item can be **Restored** (a card returns to its original column; if that column is gone, it falls back to your first live column) or **Deleted permanently** (with confirmation).
- The Archive button shows a badge with the total number of archived items.

### Search & filtering
- The search box matches **title and description** (case-insensitive).
- Filter by **label** (click label chips in the top bar; multiple labels = OR) and by **assignee** (dropdown built from assignees on live cards).
- Filters combine with AND: `search AND (any selected label) AND assignee`. A "X of Y cards shown" counter appears while filtering, non-matching columns show a "No cards match your filters" hint, and **Clear filters** resets everything.

### Theme
- 🌙/☀️ toggle in the top bar switches dark/light mode. The choice is persisted; on first launch it follows your OS preference.

## Data & privacy

- Board data (columns, cards, labels, archive) persists to `localStorage` under the key `kanban.board.v1`; theme under `kanban.theme`.
- Nothing ever leaves your browser. To reset everything, clear this site's storage in your devtools (Application → Local Storage), or run:
  ```js
  localStorage.removeItem('kanban.board.v1'); location.reload();
  ```

## Code structure

```
index.html            Page skeleton + script include order (plain scripts, no modules/build)
css/styles.css        All styling; theme variables for light/dark under [data-theme]
js/
  constants.js        Storage keys, default columns/labels, timing values
  utils.js            uid(), el() DOM builder, debounce, formatting helpers
  storage.js          localStorage read/write (board + theme), shape validation
  state.js            Single source of truth: board data model + all actions
                      (add/rename/move/archive/restore/delete for columns & cards,
                       labels). Every action persists and notifies subscribers.
  filters.js          Search/label/assignee filter state + matching logic
  dnd.js              Native HTML5 drag-and-drop for cards and column headers
  board.js            Renders the board from state; delegated click/submit/key events
  theme.js            Dark/light toggle, persistence, OS-preference fallback
  main.js             Boots all modules in dependency order
  ui/
    toast.js          Action feedback toasts (add/save/archive/delete)
    modal.js          Generic modal + Promise-based confirm dialog
    cardModal.js      Card create/edit editor (title, description, assignee, labels)
    columnDialogs.js  Add / rename / delete-column dialogs
    archivePanel.js   Archive slide-over: list, restore, permanent delete, badge
    filtersBar.js     Search box, label chips, assignee dropdown wiring
test/
  logic-test.mjs      Optional Deno script asserting state/filter/persistence behavior
```

**Optional verification.** The app needs no tooling to run. If you have [Deno](https://deno.com) installed, you can additionally run the logic test suite (it loads every module with a stubbed DOM and asserts on card/column/archive/filter/persistence behavior):

```bash
deno run --allow-read test/logic-test.mjs
```

**Design notes**

- `state.js` is the only place data mutates; rendering (`board.js`) re-renders from state on every change via a simple subscribe/notify. UI code never edits state directly.
- The app uses plain `<script>` tags (not ES modules) so it works when opened straight from disk — no CORS/module restrictions, no bundler.
- Cards keep their `columnId` even while archived, which is what makes "restore to original column" possible after a column delete/restore round-trip.
