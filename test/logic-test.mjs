/* Logic verification for the Kanban app.
 * Loads all JS modules (except main.js, which needs a real DOM) into a stubbed
 * global environment and asserts on state/filter/persistence behavior.
 * Optional verification (not needed to use the app). Requires Deno:
 *   deno run --allow-read test/logic-test.mjs
 */

// ---- environment stubs ------------------------------------------------------
globalThis.window = globalThis;

const backing = new Map();
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => void backing.set(k, String(v)),
  removeItem: (k) => void backing.delete(k),
};

// ---- load modules in the same order as index.html ---------------------------
const files = [
  'js/constants.js',
  'js/utils.js',
  'js/storage.js',
  'js/state.js',
  'js/filters.js',
  'js/ui/toast.js',
  'js/ui/modal.js',
  'js/ui/cardModal.js',
  'js/ui/columnDialogs.js',
  'js/ui/archivePanel.js',
  'js/ui/filtersBar.js',
  'js/board.js',
  'js/theme.js',
  'js/dnd.js',
];

for (const f of files) {
  const src = await Deno.readTextFile(new URL(f, import.meta.url));
  (0, eval)(src); // indirect eval -> global scope, like <script> tags
}

// ---- tiny test harness -------------------------------------------------------
let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; }
  else { failed += 1; console.error(`FAIL: ${name}`); }
}

const K = globalThis.Kanban;
check('Kanban namespace exists', Boolean(K));

// ---- initial state -----------------------------------------------------------
K.state.init();
let s = K.state.getState();
check('3 default columns', s.columns.length === 3);
check(
  'default column titles',
  JSON.stringify(s.columns.map((c) => c.title)) === JSON.stringify(['To Do', 'In Progress', 'Done']),
);
const liveCards = () => Object.values(K.state.getState().cards).filter((c) => !c.archived);
check('4 sample cards seeded', liveCards().length === 4);
check('4 default labels', s.labels.length === 4);
check('board persisted to localStorage on init', backing.has('kanban.board.v1'));

// ---- card CRUD ---------------------------------------------------------------
const todoId = s.columns[0].id;
const progId = s.columns[1].id;

const c1 = K.state.addCard(todoId, { title: 'Alpha', description: 'first task', assignee: 'Alice', labelIds: [s.labels[0].id] });
check('addCard returns id and stores card', Boolean(c1) && K.state.getCard(c1).title === 'Alpha');
check('new card appended to column', s.columns[0].cardIds[s.columns[0].cardIds.length - 1] === c1);

const c2 = K.state.addCard(todoId, { title: 'Beta' });
K.state.moveCard(c2, progId, null); // move Beta to In Progress (append)
check('moveCard between columns', !s.columns[0].cardIds.includes(c2) && s.columns[1].cardIds[s.columns[1].cardIds.length - 1] === c2);

const c3 = K.state.addCard(progId, { title: 'Gamma' }); // In Progress now ends with [Beta, Gamma]
K.state.moveCard(c2, progId, c3); // Beta before Gamma
check('moveCard reorders within column', JSON.stringify(s.columns[1].cardIds.slice(-2)) === JSON.stringify([c2, c3]));

K.state.updateCard(c1, { title: 'Alpha v2', description: 'updated', assignee: 'Bob' });
const updated = K.state.getCard(c1);
check('updateCard applies patch', updated.title === 'Alpha v2' && updated.description === 'updated' && updated.assignee === 'Bob');

K.state.updateCard(c1, { title: '   ' }); // empty title must be ignored
check('updateCard rejects empty title', K.state.getCard(c1).title === 'Alpha v2');

// ---- labels ------------------------------------------------------------------
const newLabelId = K.state.addLabel('Home', '#0ea5e9');
check('addLabel creates label', Boolean(newLabelId) && K.state.getState().labels.some((l) => l.id === newLabelId));
check(
  'addLabel with same name returns existing id (case-insensitive)',
  K.state.addLabel('home') === newLabelId,
);

// ---- column CRUD ---------------------------------------------------------------
const colCountBefore = s.columns.length;
K.state.addColumn('Reviewing');
check('addColumn appends', K.state.getState().columns.length === colCountBefore + 1 && K.state.getState().columns[colCountBefore].title === 'Reviewing');

const reviewingId = K.state.getState().columns[colCountBefore].id;
K.state.renameColumn(reviewingId, 'QA Review');
check('renameColumn updates title', K.state.getColumn(reviewingId).title === 'QA Review');
K.state.renameColumn(reviewingId, '   '); // empty rename keeps old name
check('renameColumn ignores blank input', K.state.getColumn(reviewingId).title === 'QA Review');

// move first column to the end (index clamped)
const firstColId = s.columns[0].id;
K.state.moveColumn(firstColId, 99);
check(
  'moveColumn moves to end (index clamped)',
  K.state.getState().columns[K.state.getState().columns.length - 1].id === firstColId,
);

// ---- archiving: cards ----------------------------------------------------------
K.state.archiveCard(c3);
s = K.state.getState();
check('archiveCard flags card and detaches from column', s.cards[c3].archived === true && !s.columns[1].cardIds.includes(c3));
check('archived card still in state.cards (soft delete)', Boolean(s.cards[c3]));

K.state.restoreCard(c3);
s = K.state.getState();
check('restoreCard un-archives and reattaches to original column', s.cards[c3].archived === false && s.columns[1].cardIds.includes(c3));

// restore fallback: card whose column no longer exists lands in first live column
const ghostCardId = K.state.addCard(todoId, { title: 'Ghost' });
K.state.archiveCard(ghostCardId);
s.cards[ghostCardId].columnId = 'col_does_not_exist';
K.state.restoreCard(ghostCardId);
check('restoreCard falls back to first live column when original is gone', K.state.getCard(ghostCardId).columnId === s.columns[0].id && s.columns[0].cardIds.includes(ghostCardId));

// ---- archiving: columns ----------------------------------------------------------
K.state.addCard(reviewingId, { title: 'QA task' });
check('precondition: QA column has exactly one card', K.state.getColumn(reviewingId).cardIds.length === 1);

K.state.archiveColumn(reviewingId);
s = K.state.getState();
check('archiveColumn removes column from board', !s.columns.some((c) => c.id === reviewingId));
check('archived column stored with archivedAt', s.archivedColumns.some((c) => c.id === reviewingId && Boolean(c.archivedAt)));
const qaCard = Object.values(s.cards).find((c) => c.title === 'QA task');
check('cards of deleted column are archived (not destroyed)', qaCard && qaCard.archived === true);

K.state.restoreColumn(reviewingId);
s = K.state.getState();
check('restoreColumn puts column back', s.columns.some((c) => c.id === reviewingId));
const restoredQaCard = Object.values(s.cards).find((c) => c.title === 'QA task');
check(
  'restoring column un-archives its cards and reattaches them',
  restoredQaCard.archived === false && s.getColumn(reviewingId).cardIds.includes(restoredQaCard.id),
);

// permanent delete of an archived column removes it and its tied cards
K.state.archiveColumn(reviewingId);
const qaCardIdBefore = Object.values(K.state.getState().cards).find((c) => c.title === 'QA task').id;
K.state.deleteColumnPermanently(reviewingId);
s = K.state.getState();
check('deleteColumnPermanently removes archived column', !s.archivedColumns.some((c) => c.id === reviewingId));
check('deleteColumnPermanently also removes its cards', !s.cards[qaCardIdBefore]);

// ---- permanent card delete --------------------------------------------------------
K.state.deleteCardPermanently(c1);
s = K.state.getState();
check('deleteCardPermanently removes card everywhere', !s.cards[c1] && !Object.values(s.columns).some((c) => c.cardIds.includes(c1)));

// ---- Done-column indicator logic ---------------------------------------------------
check("isDoneColumn('Done') is true", K.state.isDoneColumn({ title: 'Done' }));
check("isDoneColumn(' done ') is true (case/trim)", K.state.isDoneColumn({ title: ' done ' }));
check("isDoneColumn('In Progress') is false", !K.state.isDoneColumn({ title: 'In Progress' }));

// ---- filters ------------------------------------------------------------------------
const f = K.filters;
f.clear();
check('no active filters -> all cards match', liveCards().every((c) => f.matches(c)));

const planCard = Object.values(K.state.getState().cards).find((c) => c.title === 'Plan the week');
f.set({ search: 'plan the' });
check('search matches title', f.matches(planCard));
check(
  'search does not match unrelated card',
  !f.matches(Object.values(K.state.getState().cards).find((c) => c.title === 'Read 20 pages')),
);

const descOnly = Object.values(K.state.getState().cards).find((c) => c.description.includes('nightstand'));
f.clear();
f.set({ search: 'nightstand' }); // appears only in the description text
check('search matches description', f.matches(descOnly));

// label filter (OR within selected labels)
f.clear();
const workLabel = K.state.getState().labels.find((l) => l.name === 'Work');
const personalLabel = K.state.getState().labels.find((l) => l.name === 'Personal');
f.toggleLabel(workLabel.id);
check('label filter matches cards with that label', f.matches(planCard)); // Plan the week has Work
check('label filter excludes others', !f.matches(descOnly)); // Read 20 pages is Personal only
f.toggleLabel(personalLabel.id);
check('two selected labels = OR', f.matches(descOnly) && f.matches(planCard));

// combined: search AND label AND assignee
f.clear();
const aliceCard = K.state.addCard(todoId, { title: 'Zeta report', description: '', assignee: 'Alice' });
K.state.updateCard(aliceCard, { labelIds: [workLabel.id] });
f.set({ search: 'zeta', assignee: 'Alice' });
check('search + assignee combine (AND)', f.matches(K.state.getCard(aliceCard)));
f.toggleLabel(personalLabel.id); // Zeta has Work, not Personal -> must be excluded now
check('adding a non-matching label excludes card (AND across categories)', !f.matches(K.state.getCard(aliceCard)));
f.clear();
check('clear() resets all filters', f.isActive() === false && liveCards().every((c) => f.matches(c)));

// assignee selector data ('You' comes from the seeded sample card; Bob's card was deleted)
K.state.updateCard(descOnly, { assignee: 'Carol' });
const assignees = K.state.liveAssignees();
check('liveAssignees returns sorted distinct names', JSON.stringify(assignees) === JSON.stringify(['Alice', 'Carol', 'You']));

// ---- persistence round-trip -------------------------------------------------------------
const savedRaw = backing.get('kanban.board.v1');
const reloaded = JSON.parse(savedRaw);
check(
  'persisted board has expected shape',
  Array.isArray(reloaded.columns) && typeof reloaded.cards === 'object' && Array.isArray(reloaded.archivedColumns),
);

// simulate a page reload: state is rebuilt from storage
K.state.init();
s = K.state.getState();
check(
  'reload restores persisted board (cards survive)',
  s.columns.length > 0 && Object.values(s.cards).some((c) => c.title === 'Zeta report'),
);

// theme persistence helpers
K.storage.saveTheme('dark');
check('theme save/load round-trip', K.storage.loadTheme() === 'dark');

// corrupted storage falls back to a fresh board
backing.set('kanban.board.v1', '{not json');
check('corrupted board JSON -> null (fresh seed fallback)', K.storage.loadBoard() === null);

// ---- summary -----------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) Deno.exit(1);
console.log('ALL LOGIC TESTS PASSED');
