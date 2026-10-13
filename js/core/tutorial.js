/* tutorial.js — a tour of REAL controls with a disposable in-memory tree.
   The user's DOM nodes, lesson, viewport and tree objects are put aside intact.
   Persistence/auth hooks defer changes while state.tutorialActive is true. */
(function () {
  const KEY = 'tree-tutorial-seen';
  const $ = id => document.getElementById(id);
  const layer = $('tutorial-layer'), card = $('tutorial-card'), replay = $('menu-tutorial');
  const next = $('tutorial-next'), back = $('tutorial-back');
  const demoLesson = `=== SECTION 1: A small first step ===
A prerequisite is something you learn before a topic that builds on it. Follow the arrows from foundations to more advanced ideas.

[QUESTION 1]
What should you learn before a topic that builds on it?
(A) Its prerequisites
(B) An unrelated topic
(C) Only the most advanced topic
[ANSWER: A]
[/QUESTION]

=== SECTION 2: Keep going ===
Your answer is saved with this topic. Answering every regular question completes the topic, even if some answers were wrong. Bonus practice is optional.
`;
  const demoTree = { topic: 'Tutorial sample', language: 'English', nodes: [
    { id: 'foundations', label: 'Foundations', done: true, explanation: 'The starting ideas.' },
    { id: 'next', label: 'Your next topic', requires: ['foundations'], explanation: 'Build on the foundations.' },
    { id: 'advanced', label: 'The next unlock', requires: ['next'] }
  ] };
  const click = id => $(id).click();
  const menu = id => setMenuOpen($(id), true);
  const demoNode = () => state.nodes.get(2).el;
  const nodeSelector = '#world .node[data-id="2"]';
  const uploadTree = '#tree-modal-backdrop .upload-dropzone';
  const steps = [
    { name: 'Tree menu', title: 'Start here: Tree', text: 'Click Tree to create, import, or export a learning tree.', target: '#btn-tree-menu', allow: '#btn-tree-menu', advance: '#btn-tree-menu', show: () => click('btn-tree-menu') },
    { name: 'New tree', title: 'Create a tree', text: 'Choose New tree to start from a topic or file. Load JSON opens an existing tree.', menu: 'tree-menu', target: '#tree-menu', allow: '#menu-new-tree', advance: '#menu-new-tree', show: () => click('menu-new-tree') },
    { name: 'Topic prompt', title: 'Start from a topic', text: 'Enter a topic and language, then copy the prompt into an AI chatbot.', phase: 'tree', target: '#tree-mode-topic-panel', allow: '#tree-topic-input, #tree-language-input, #btn-copy-tree-prompt, #tree-prompt-box' },
    { name: 'From a file', title: 'Start from a file', text: 'Choose From a file. Copy the prompt into an AI chatbot and attach your notes, paper, or other material.', phase: 'file', target: '#tree-mode-tab-file, #tree-mode-file-panel:not(.hidden), #tree-mode-topic-panel:not(.hidden)', allow: '#tree-mode-tab-file, #tree-mode-tab-topic, #btn-copy-tree-file-prompt, #tree-file-prompt-box, #tree-topic-input, #tree-language-input, #tree-prompt-box, #btn-copy-tree-prompt' },
    { name: 'Import the result', title: 'Upload your tree', text: 'Upload the .json file the chatbot gives you. Here, Next opens an example.', phase: 'tree', target: uploadTree, allow: uploadTree, advance: uploadTree, substitute: true },
    { name: 'Tree and navigation', title: 'Explore your tree', text: 'Green is complete, blue is available, and faded is locked. Arrows show prerequisites. Drag to pan; scroll or pinch to zoom.', target: '#canvas', allow: '#canvas', map: true, nextLabel: 'Choose a topic →' },
    { name: 'Choose a topic', title: 'Open a topic', text: 'Click a blue topic to learn. Complete its prerequisites to unlock the topics that follow.', target: nodeSelector, allow: nodeSelector, advance: nodeSelector, show: () => demoNode().click() },
    { name: 'Generate lessons', title: 'Generate tree lessons', text: 'Attach one AI work file in a chatbot: the lesson rules appear once for the whole tree. Import completed lessons together, even after a cut-off reply. A fresh work file resumes missing lessons. Try lesson imports this prepared example.', phase: 'generation', target: '#generation-modal-backdrop .modal-body', allow: '#generation-language, #generation-reply-size, #generation-start-message, #btn-copy-generation-message, #generation-output, #btn-import-generation', advance: '#btn-import-generation', show: () => click('btn-import-generation'), nextLabel: 'Try lesson →' },
    { name: 'Try a question', title: 'Answer a question', text: 'Choose an answer. Lessons can also include interactive tables, timelines, equations, and graphs.', phase: 'lesson', target: '#sv-body .q-card', allow: '#sv-body .q-opt', advance: '#sv-body .q-opt', show: () => $('sv-body').querySelector('.q-opt[data-letter="' + viewer.questions.get(1).correct + '"]').click() },
    { name: 'Feedback and progress', title: 'Track your progress', text: 'Answer every regular question to complete a topic. A perfect score isn’t required; bonus practice is optional.', phase: 'answered', target: '#sv-score, #sv-progress-wrap', allow: '#sv-body', nextLabel: 'Notes →' },
    { name: 'Open notes', title: 'Keep your own notes', text: 'Click Notes to write reminders beside the lesson. Notes and lesson progress save automatically.', phase: 'answered', target: '#btn-toggle-notes', allow: '#btn-toggle-notes', advance: '#btn-toggle-notes', show: () => click('btn-toggle-notes') },
    { name: 'Write a note', title: 'Write or draw a note', text: 'Write reminders, or choose Draw to sketch. Pick an ink color, erase, or undo strokes. Your notes save with this topic. Edit tree returns to the tree to try editing.', phase: 'notes', target: '#sv-notes-panel', allow: '#sv-notes-ta, #sv-notes-tabs, #sv-notes-drawing', nextLabel: 'Edit tree →' },
    { name: 'Edit mode', title: 'Edit your tree', text: 'Choose Edit to change topics and their prerequisites.', menu: 'mode-menu', target: '#mode-menu', allow: '#mode-edit-item', advance: '#mode-edit-item', show: () => click('mode-edit-item') },
    { name: 'Try editing', title: 'Change topics and links', text: 'Use + Node to add a topic. Edit its label or scope, or mark it optional. Link prereq connects topics; Delete TXT clears a lesson, and Delete removes a topic.', phase: 'edit', target: nodeSelector, allow: '#btn-add-node, #canvas', edit: true, nextLabel: 'Mark known →' },
    { name: 'Mark known mode', title: 'Skip what you know', text: 'Choose Mark known to complete topics you already understand.', menu: 'mode-menu', target: '#mode-menu', allow: '#mode-mark-known-item', advance: '#mode-mark-known-item', show: () => click('mode-mark-known-item') },
    { name: 'Mark a topic', title: 'Mark a topic complete', text: 'Click to complete this topic and unlock the next one. Click again to undo it and reset dependent topics.', phase: 'known', target: nodeSelector, allow: nodeSelector, advance: nodeSelector, show: () => demoNode().click() },
    { name: 'See the unlock', title: 'Unlock the next topic', text: 'Completing a topic unlocks the blue topic that follows it. Now open My Trees (📚) to save this tree.', phase: 'unlocked', target: '#world .node[data-id="3"], #btn-my-trees', allow: '#btn-my-trees', advance: '#btn-my-trees', show: () => click('btn-my-trees'), nextLabel: 'My Trees →' },
    { name: 'Save a tree', title: 'Save your tree', text: 'This is My Trees, opened with 📚. Choose Save current tree. In this tour, it saves as Tutorial tree; for your own trees, you choose a name.', phase: 'library', target: '#library-modal-title, #btn-save-current-tree', allow: '#btn-save-current-tree', advance: '#btn-save-current-tree', show: () => saveCurrentTreeToLibrary(), nextLabel: 'Save sample →' },
    { name: 'Your saved trees', title: 'Manage saved trees', text: 'Your sample is saved here. Open returns to the tree. Rename, Duplicate, and Delete manage saved copies. Open tree continues the tour on the canvas.', phase: 'saved', target: '#library-grid .library-card, #library-empty:not(.hidden)', allow: '#library-grid .lc-actions .btn', advance: '#library-grid .lc-open', show: () => { const id = state.libraryId || Object.keys(libraryCache)[0]; if (id) openLibraryEntry(id); }, nextLabel: 'Open tree →' },
    { name: 'Export', title: 'Export your tree', text: 'Back on the tree, use Tree to export a file. Structure only includes topics and links; Structure + content includes lessons too. Account opens settings next.', menu: 'tree-menu', target: '#tree-menu', allow: '', nextLabel: 'Account →' },
    { name: 'Account settings', title: 'Account settings', text: 'Switch the theme or interface language here. Account opens sign-in and sync. View tutorial appears here after finishing or skipping.', menu: 'account-menu', target: '#account-menu', allow: '#menu-dark-mode, #menu-language, #menu-account', advance: '#menu-account', show: () => click('menu-account'), theme: true, nextLabel: 'Sign in →' },
    { name: 'Account and sync', title: 'Sync across devices', text: 'Sign in or create an account to sync your saved trees across devices.', phase: 'account', target: '#account-modal-shell', allow: '' }
  ];
  let index = 0, saved = null, inert = [], busy = false, frame = null, advanceTimer = null, demoAnswer = null, editId = 2, runId = 0;
  const targetElement = () => steps[index].edit ? (isMobileViewport() && nodeEditor.classList.contains('open') ? $('node-editor-shell') : state.nodes.get(editId)?.el || world.querySelector('.node') || canvas) : document.querySelector(steps[index].target);
  const mobileHints = {
    0: 'Tap Tree to create or import a learning tree. This tour uses a sample, so you can try everything safely.',
    2: 'Enter a topic, then copy the prompt into an AI chatbot. For this tour, tap Next to keep exploring.',
    3: 'Have notes or a paper? Copy this prompt and attach your file in the chatbot. No upload is needed during this tour.',
    4: 'Upload the chatbot’s .json here to build your tree. Tap Next to load our sample tree.',
    5: 'Drag to explore; pinch to zoom. Green topics are complete, blue topics are ready, and faded topics need prerequisites.',
    6: 'Tap the blue topic to get a lesson. You can also tap Next to open it for you.',
    7: 'Send one AI work file for the whole tree. Import finished lessons even if the reply cuts off, then resume missing ones. Tap Try lesson to import our prepared sample.',
    8: 'Tap an answer to try the quiz. Your answers save as you go.',
    10: 'Tap Notes to write or draw something you want to remember.',
    11: 'Try writing a note, or tap Draw to sketch. Edit tree closes the lesson and returns to the tree to try editing.',
    13: 'Tap a topic to edit its name, scope, or prerequisites. Use + to add a topic. Changes here only affect the sample.',
    15: 'Tap this topic to mark it complete. Tap it again to undo.',
    16: 'This topic is now unlocked. Tap 📚 (My Trees) to save your tree, or use My Trees below to open it for you.',
    17: 'You’re in My Trees (📚). Tap Save current tree. We name this sample Tutorial tree; for your own trees, you choose a name.',
    18: 'Your sample is saved here. Open brings you back to its tree. You can also rename, copy, or delete it. Tap Open tree to continue.',
    21: 'Sign in to sync your trees across devices. You can also use the app without an account. Tap Finish to start.'
  };
  const treeKeys = ['nodes', 'edges', 'prereqs', 'dependents', 'nextId', 'viewport', 'drag', 'mode', 'linkSource', 'language', 'isSpanish', 'topic', 'libraryId'];
  let seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch {}
  replay.hidden = !seen;

  const stash = el => { const fragment = document.createDocumentFragment(); while (el.firstChild) fragment.appendChild(el.firstChild); return fragment; };
  function clearInert() { inert.forEach(el => el.removeAttribute('inert')); inert = []; }
  function protectPage() {
    clearInert();
    const step = steps[index];
    const roots = [layer, ...document.querySelectorAll([step.target, step.allow, step.edit && isMobileViewport() ? '#node-editor-backdrop' : ''].filter(Boolean).join(','))];
    function visit(el) {
      if (el.tagName === 'SCRIPT' || roots.some(root => root === el || root.contains(el))) return;
      if (roots.some(root => el.contains(root))) [...el.children].forEach(visit);
      else if (!el.hasAttribute('inert')) { el.setAttribute('inert', ''); inert.push(el); }
    }
    [...document.body.children].forEach(visit);
  }
  function prepareSample() {
    loadFromJSON({ ...demoTree, topic:t(demoTree.topic), language:uiLanguage==='es'?'Español':'English', isSpanish:uiLanguage==='es', nodes:demoTree.nodes.map(node=>({...node,label:t(node.label),explanation:node.explanation?t(node.explanation):undefined})) });
    if (isMobileViewport()) return; // Use the same readable, pannable tree view as the app.
    // Demo nodes use the real layout. Center them in the space above the card.
    const width = window.innerWidth, height = window.innerHeight - card.getBoundingClientRect().height - 110;
    const bounds = [...state.nodes.values()];
    const right = Math.max(...bounds.map(n => n.x + nodeW()));
    const top = Math.min(...bounds.map(n => n.y));
    const bottom = Math.max(...bounds.map(n => n.y + nodeH()));
    const scale = Math.min(1, (width - 32) / right, Math.max(80, height) / (bottom - top));
    state.viewport = { x: (width - right * scale) / 2, y: 100 + (Math.max(80, height) - (bottom - top) * scale) / 2 - top * scale, scale };
    applyTransform(false);
  }
  function resetPanels() {
    closeNodeEditor();
    closeAllDropdowns();
    document.querySelectorAll('.modal-backdrop').forEach(el => el.classList.remove('open'));
    closeModal(); closeViewer();
    $('sv-notes-panel').classList.remove('open'); $('btn-toggle-notes').classList.remove('active');
    cancelLink(); setMode('browse');
  }
  function enterStep(step, resetSample) {
    resetPanels(); setNotesMode(false);
    if (resetSample || !state.nodes.has(2)) prepareSample();
    const phase = step.phase;
    if (['tree', 'file'].includes(phase)) {
      if (resetSample || !$('tree-topic-input').value) { $('tree-topic-input').value = t('Learning something new'); $('tree-language-input').value = ''; }
      openTreeModal(); if (phase === 'file') setTreeMode('file');
    }
    if (phase === 'generation') {
      openGenerationModal();
      $('generation-output').value = JSON.stringify({ format: LESSON_RECORD_FORMAT, treeKey: generationTreeKey(buildTreeJSON(false)), id: 'next', content: t(demoLesson) });
      refreshGenerationImportControls();
    }
    if (['lesson', 'answered', 'notes'].includes(phase)) {
      if (phase !== 'lesson') state.nodes.get(2)._sessionAnswers = { 1: demoAnswer || 'A' };
      openViewer(t(demoLesson), 2);
      if (phase === 'notes') {
        toggleNotesPanel(); if (!state.nodes.get(2)._notes) $('sv-notes-ta').value = t('My sample note…');
        // Center the two full-size panels together when there is room. Moving
        // the demo viewer keeps the notes visible without changing either size.
        if (!isMobileViewport()) {
          const combined = $('sv-window').offsetWidth + $('sv-notes-panel').offsetWidth + 10;
          if (combined + 24 <= window.innerWidth) {
            $('sv-window').style.left = (window.innerWidth - combined) / 2 + 'px';
            syncNotesPanelPosition();
          }
        }
      }
    }
    if (phase === 'edit') { editId = 2; setMode('edit'); if (!isMobileViewport()) demoNode().classList.add('actions-open'); }
    if (phase === 'known') setMode('markKnown');
    if (phase === 'unlocked') { state.nodes.get(2).done = true; updateAllStatuses(); }
    if (phase === 'unlocked') {
      const node = state.nodes.get(3);
      if (node) {
        const scale = Math.min(1, (window.innerWidth - 40) / nodeW());
        state.viewport = {scale, x: window.innerWidth / 2 - (node.x + nodeW() / 2) * scale,
          y: Math.max(100, $('toolbar').getBoundingClientRect().bottom + 24) - node.y * scale};
        applyTransform(false);
      }
    }
    if (['library', 'saved'].includes(phase)) {
      state.nodes.get(2)._sessionTxt = t(demoLesson);
      if (phase === 'saved') {
        if (!Object.keys(libraryCache).length) libraryCache['tutorial-example'] = { name: t('Tutorial tree'), savedAt: Date.now(), data: buildTreeJSON(true) };
        if (!state.libraryId || !libraryCache[state.libraryId]) state.libraryId = Object.keys(libraryCache)[0];
      }
      $('library-modal-backdrop').classList.add('open'); renderLibraryGrid();
    }
    if (phase === 'account') $('account-modal-backdrop').classList.add('open');
    if (step.menu) menu(step.menu);
    if (step.target === nodeSelector) {
      const scale = Math.min(1, (window.innerWidth - 40) / nodeW());
      const node = state.nodes.get(2);
      state.viewport = { scale, x: (window.innerWidth - nodeW() * scale) / 2 - node.x * scale,
        y: Math.max(80, $('toolbar').getBoundingClientRect().bottom + 12) - node.y * scale };
      applyTransform(false);
    }
    // The tour exposes real dialog controls alongside its coachmark.
    document.querySelectorAll('[aria-modal="true"]').forEach(el => el.setAttribute('aria-modal', 'false'));
  }
  function placeCard(target, r) {
    // Reset only the coachmark. Never reserve space by resizing app windows.
    card.style.cssText = '';
    if (isMobileViewport()) {
      const inset = parseFloat(document.documentElement.style.getPropertyValue('--mobile-keyboard-inset')) || 0;
      const height = Math.ceil(card.getBoundingClientRect().height + inset);
      document.body.style.setProperty('--tutorial-height', height + 'px');
      return;
    }
    document.body.style.removeProperty('--tutorial-height');
    const width = window.innerWidth, height = window.innerHeight, margin = 12, gap = 12;
    // Freeze the measured width before switching from right/bottom anchors to
    // left/top; mobile's width:auto would otherwise grow to its content width.
    card.style.width = Math.min(card.getBoundingClientRect().width, width - margin * 2) + 'px';
    const panel = target.closest('.modal-shell, #sv-window, #sv-notes-panel, .dropdown-menu');
    const obstacle = panel ? panel.getBoundingClientRect() : r;
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const clamp = (v, low, high) => Math.max(low, Math.min(v, Math.max(low, high)));
    // A narrower hint can fit beside a full-size dialog on a laptop.
    const sideSpace = Math.max(obstacle.left - margin - gap, width - obstacle.right - margin - gap);
    if (panel && sideSpace >= 340) {
      card.style.width = Math.min(card.getBoundingClientRect().width, sideSpace) + 'px';
      // A hint beside a dialog can use the available screen height. The
      // overlay height limit otherwise leaves long hints in a tiny scrollbox.
      card.style.maxHeight = (height - margin * 2) + 'px';
    }
    function candidates(bounds) {
      const c = card.getBoundingClientRect(), w = c.width, h = c.height;
      const x = clamp((bounds.left + bounds.right - w) / 2, margin, width - w - margin);
      const y = clamp(bounds.top, margin, height - h - margin);
      return [
        [bounds.right + gap, y], [bounds.left - gap - w, y],
        [x, bounds.bottom + gap], [x, bounds.top - gap - h],
        [width - w - margin, height - h - margin], [margin, height - h - margin],
        [width - w - margin, margin], [margin, margin]
      ].map(([left, top]) => ({left, top, right: left + w, bottom: top + h}));
    }
    const fits = c => c.left >= margin && c.top >= margin && c.right <= width - margin + 1 && c.bottom <= height - margin + 1;
    const clear = bounds => candidates(bounds).find(c => fits(c) && !overlap(c, bounds));
    let chosen = clear(obstacle);
    if (!chosen) {
      // Restore the shorter overlay before looking for space over the panel.
      card.style.maxHeight = '';
      chosen = clear(obstacle) || clear(r);
    }
    // Small screens can require floating over an unused part of the dialog.
    // Favor the highlighted control, and keep both Skip and Next available.
    if (!chosen) chosen = clear(target.getBoundingClientRect());
    if (!chosen) {
      const controls = steps[index].allow ? [...document.querySelectorAll(steps[index].allow)].filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect()) : [];
      chosen = candidates(r).filter(fits).sort((a, b) => {
        const score = c => overlap(c, r) + controls.reduce((sum, rect) => sum + overlap(c, rect) * 4, 0);
        return score(a) - score(b);
      })[0];
    }
    if (!chosen) chosen = { left: margin, top: margin };
    card.style.left = chosen.left + 'px'; card.style.top = chosen.top + 'px';
    card.style.right = 'auto'; card.style.bottom = 'auto';
  }
  function position() {
    if (!state.tutorialActive) return;
    const target = targetElement();
    if (!target) return;
    const targets = steps[index].edit ? [target] : [...document.querySelectorAll(steps[index].target)].filter(el => el.getClientRects().length);
    const rects = (targets.length ? targets : [target]).map(el => el.getBoundingClientRect());
    const r = { left: Math.min(...rects.map(r => r.left)), top: Math.min(...rects.map(r => r.top)),
      right: Math.max(...rects.map(r => r.right)), bottom: Math.max(...rects.map(r => r.bottom)) };
    placeCard(target, r);
    // Each target gets its own hole and border. Never illuminate the space
    // between a tab and its panel (which includes the other tab).
    document.querySelectorAll('.tutorial-extra-spotlight').forEach(el => el.remove());
    (targets.length ? targets : [target]).forEach((element, i) => {
      const bounds = element.getBoundingClientRect();
      const padding = element.id === 'tree-mode-tab-file' ? 0 : 6;
      let left = Math.max(6, bounds.left - padding), top = Math.max(6, bounds.top - padding);
      let right = Math.min(window.innerWidth - 6, bounds.right + padding), bottom = Math.min(window.innerHeight - 6, bounds.bottom + padding);
      if (isMobileViewport()) bottom = Math.min(bottom, card.getBoundingClientRect().top - 6);
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowY)) {
          const pr = parent.getBoundingClientRect(); top = Math.max(top, pr.top); bottom = Math.min(bottom, pr.bottom);
        }
      }
      if (steps[index].map) { left = 8; top = 110; right = window.innerWidth - 8; }
      for (const id of ['tutorial-hole', 'tutorial-ring']) {
        const base = $(id), rect = i ? base.cloneNode(false) : base;
        if (i) { rect.id = id + '-' + i; rect.classList.add('tutorial-extra-spotlight'); base.parentElement.appendChild(rect); }
        rect.setAttribute('x', left); rect.setAttribute('y', top);
        rect.setAttribute('width', Math.max(0, right - left)); rect.setAttribute('height', Math.max(0, bottom - top));
      }
    });
  }
  function schedulePosition() {
    if (!state.tutorialActive || frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; position(); });
  }
  function go(i) {
    if (!state.tutorialActive) return;
    clearTimeout(advanceTimer); clearInert();
    if (index === 8) demoAnswer = state.nodes.get(2)?._sessionAnswers?.[1] || null;
    const resetSample = !saved || i !== index + 1;
    index = i;
    uiText($('tutorial-title'), steps[i].title); uiText($('tutorial-intro'), isMobileViewport() && mobileHints[i] ? mobileHints[i] : steps[i].text);
    uiText($('tutorial-skip'), isMobileViewport() ? 'Skip ✕' : 'Skip tutorial ✕');
    uiText($('tutorial-count'), `${i + 1} / ${steps.length}`);
    back.disabled = i === 0;
    uiText(next, i === steps.length - 1 ? 'Finish ✓' : steps[i].nextLabel || (isMobileViewport() ? 'Next →' : steps[i].show || steps[i].advance ? 'Show me →' : 'Next →'));
    position(); enterStep(steps[i], resetSample); protectPage();
    const target = document.querySelector(steps[i].target);
    if (target?.closest('.modal-body, #sv-body')) target.scrollIntoView?.({ block: 'nearest' });
    card.focus({ preventScroll: true }); position(); schedulePosition();
  }
  function openTutorial() {
    if (state.tutorialActive) return;
    runId++;
    // Finish an already-scheduled save of the real lesson before swapping it.
    if (notesSaveTimer || scrollSaveTimer) autoSaveProgress();
    clearTimeout(notesSaveTimer); clearTimeout(scrollSaveTimer);
    notesSaveTimer = scrollSaveTimer = null;
    // Snapshot live elements instead of serializing/reloading: listeners, notes,
    // quiz state, unsaved edits, and even node identity survive replay unchanged.
    saved = {
      tree: Object.fromEntries(treeKeys.map(key => [key, state[key]])),
      viewer: { ...viewer }, library: libraryCache, edges: new Map(edgeEls),
      modalNode: _modalNodeId, positioned: svUserPositioned, scroll: $('sv-body').scrollTop,
      editorNode: mobileEditId,
      editorPrerequisitesOpen: editorPrerequisites.open,
      dark: document.documentElement.classList.contains('dark'),
      uiLanguage, drawingTool, drawingGesture, notesOffset: { ...notesOffset },
      attrs: [...document.body.querySelectorAll('*'), document.body].map(el => ({ el,
        className: el.getAttribute('class'), style: el.getAttribute('style'), aria: el.getAttribute('aria-modal'),
        hidden: el.hidden, open: el.open, selected: el.getAttribute('aria-selected'), pressed: el.getAttribute('aria-pressed'), disabled: el.disabled, uiSource: el.getAttribute('data-ui-text'), uiAttrs: el.getAttribute('data-ui-attrs'),
        value: 'value' in el && !['file', 'password'].includes(el.type) ? el.value : undefined,
        checked: 'checked' in el ? el.checked : undefined,
        text: ['btn-mode', 'menu-reset-progress', 'btn-save-current-tree', 'library-modal-meta', 'tree-modal-meta', 'prompt-box', 'btn-copy-prompt', 'btn-copy-tree-prompt', 'btn-copy-tree-file-prompt', 'sv-topic', 'sv-score', 'generation-status', 'generation-result', 'generation-import-source', 'btn-copy-generation-message'].includes(el.id) ? el.textContent : undefined
      }))
    };
    saved.world = stash(world); saved.svg = stash(svgWorld); saved.body = stash($('sv-body')); saved.checkpoints = stash($('sv-progress-checkpoints')); saved.libraryDOM = stash($('library-grid')); saved.drawingDOM = stash(drawingPad); saved.editorLinks = stash($('node-editor-links')); saved.generationIssues = stash($('generation-issues'));
    drawingGesture = null; Object.assign(notesOffset, { x: 0, y: 0 });
    edgeEls.clear(); libraryCache = {};
    for (const key of ['nodes', 'prereqs', 'dependents']) state[key] = new Map();
    state.edges = new Set(); state.viewport = { ...state.viewport }; state.drag = { ...state.drag, active: false };
    state.tutorialActive = true; document.body.classList.add('tutorial-active');
    layer.hidden = false; demoAnswer = null; busy = false;
    go(0);
  }
  function endTutorial() {
    if (!state.tutorialActive) return;
    runId++;
    clearTimeout(advanceTimer); clearTimeout(notesSaveTimer); clearTimeout(scrollSaveTimer); clearTimeout(transformTimer);
    notesSaveTimer = scrollSaveTimer = null;
    clearInert(); resetPanels();
    const pendingAuth = state.tutorialPendingAuth;
    const refreshProgress = state.tutorialRefreshProgress, refreshLibrary = state.tutorialRefreshLibrary;
    delete state.tutorialPendingAuth; delete state.tutorialRefreshProgress; delete state.tutorialRefreshLibrary;
    world.replaceChildren(saved.world); svgWorld.replaceChildren(saved.svg);
    $('sv-body').replaceChildren(saved.body); $('sv-progress-checkpoints').replaceChildren(saved.checkpoints);
    $('library-grid').replaceChildren(saved.libraryDOM); drawingPad.replaceChildren(saved.drawingDOM);
    $('node-editor-links').replaceChildren(saved.editorLinks);
    $('generation-issues').replaceChildren(saved.generationIssues);
    drawingTool = saved.drawingTool; drawingGesture = saved.drawingGesture; Object.assign(notesOffset, saved.notesOffset);
    Object.assign(state, saved.tree); Object.assign(viewer, saved.viewer); libraryCache = saved.library;
    edgeEls.clear(); saved.edges.forEach((path, key) => edgeEls.set(key, path));
    _modalNodeId = saved.modalNode; svUserPositioned = saved.positioned;
    mobileEditId = saved.editorNode;
    editorPrerequisites.open = saved.editorPrerequisitesOpen;
    saved.attrs.forEach(({ el, className, style, aria, value, checked, text, hidden, open, selected, pressed, disabled, uiSource, uiAttrs }) => {
      for (const [attr, val] of [['class', className], ['style', style], ['aria-modal', aria], ['aria-selected', selected], ['aria-pressed', pressed], ['data-ui-text', uiSource], ['data-ui-attrs', uiAttrs]]) {
        if (val === null) el.removeAttribute(attr); else el.setAttribute(attr, val);
      }
      if (hidden !== undefined) el.hidden = hidden;
      if (open !== undefined) el.open = open;
      if (disabled !== undefined) el.disabled = disabled;
      if (value !== undefined && el.type !== 'file') el.value = value;
      if (checked !== undefined) el.checked = checked;
      if (text !== undefined) el.textContent = text;
    });
    state.tutorialActive = false;
    refreshInterfaceLanguage(); updateAllStatuses();
    if (saved.uiLanguage !== uiLanguage) document.dispatchEvent(new CustomEvent('ui-language-change'));
    setDarkMode(saved.dark, false);
    $('sv-body').scrollTop = saved.scroll; applyTransform(false);
    layer.hidden = true; replay.hidden = false; seen = true;
    try { localStorage.setItem(KEY, '1'); } catch {}
    if (pendingAuth) applyAccountUser(pendingAuth.user);
    else { if (refreshProgress) refreshProgressFromSource(); if (refreshLibrary) refreshLibraryFromSource(); }
    saved = null;
    // Reveal replay immediately, unless we restored a lesson/modal above it.
    if (!document.querySelector('.modal-backdrop.open, #session-viewer.sv-open')) menu('account-menu');
    $('btn-account-menu').focus();
    showToast('Tour ended. Account dropdown (👤) → View tutorial replays it.', 7000);
  }
  async function showNext() {
    if (busy || !state.tutorialActive) return;
    if (index === steps.length - 1) { endTutorial(); return; }
    const origin = index, run = runId; busy = true;
    try {
      if (steps[index].show) await steps[index].show();
      if (state.tutorialActive && index === origin && runId === run) go(origin + 1);
    } finally { if (runId === run) busy = false; }
  }
  function allowed(target) {
    return card.contains(target) || !!(steps[index].edit && isMobileViewport() && target.closest('#node-editor-backdrop')) || !!(steps[index].allow && target.closest(steps[index].allow));
  }
  document.addEventListener('click', e => {
    if (!state.tutorialActive || card.contains(e.target)) return;
    if (!allowed(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    const step = steps[index];
    if (step.theme && e.target.closest('#menu-dark-mode')) {
      e.preventDefault(); e.stopImmediatePropagation(); setDarkMode(!document.documentElement.classList.contains('dark'), false); return;
    }
    if (step.advance && e.target.closest(step.advance)) {
      if (step.substitute) { e.preventDefault(); e.stopImmediatePropagation(); }
      const origin = index, run = runId;
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(() => { if (state.tutorialActive && index === origin && runId === run && !busy) go(origin + 1); }, 0);
    }
    if (step.edit && e.target.closest('#btn-add-node')) {
      const origin = index, run = runId;
      setTimeout(() => {
        if (!state.tutorialActive || index !== origin || runId !== run) return;
        editId = state.nextId - 1;
        const node = state.nodes.get(editId);
        if (!node) return;
        node.el.classList.add('actions-open');
        state.viewport.x = (window.innerWidth - nodeW() * state.viewport.scale) / 2 - node.x * state.viewport.scale;
        state.viewport.y = Math.max(80, $('toolbar').getBoundingClientRect().bottom + 12) - node.y * state.viewport.scale;
        applyTransform(false); schedulePosition();
      }, 0);
    }
    const origin = index;
    setTimeout(() => { if (state.tutorialActive && index === origin) { protectPage(); schedulePosition(); } }, 0);
    schedulePosition();
  }, true);
  document.addEventListener('pointerdown', e => {
    if (state.tutorialActive && !allowed(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('keydown', e => {
    if (!state.tutorialActive || e.key === 'Escape') return;
    if (e.key !== 'Tab') {
      if (!allowed(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); }
      return;
    }
    const focusable = 'button:not([disabled]), input:not([disabled]):not([type="file"]), textarea, select, [tabindex="0"], [contenteditable="true"]';
    const controls = [...document.querySelectorAll(focusable)].filter(el => allowed(el) && !el.closest('[inert]') && el.getClientRects().length);
    const current = controls.indexOf(document.activeElement);
    const target = controls[current < 0 ? (e.shiftKey ? controls.length - 1 : 0) : (current + (e.shiftKey ? -1 : 1) + controls.length) % controls.length];
    e.preventDefault(); e.stopImmediatePropagation(); target?.focus();
  }, true);
  document.addEventListener('scroll', schedulePosition, true);
  document.addEventListener('pointermove', schedulePosition);
  window.addEventListener('resize', schedulePosition);
  window.visualViewport?.addEventListener('resize', schedulePosition);
  window.visualViewport?.addEventListener('scroll', schedulePosition);
  document.addEventListener('ui-language-change', () => { if (state.tutorialActive) schedulePosition(); });
  // Restore the real tree before the library's page-exit save runs.
  window.addEventListener('pagehide', () => { if (state.tutorialActive) endTutorial(); }, { capture: true });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(schedulePosition).observe(card);
  onEscape(200, e => { if (!state.tutorialActive) return false; e.preventDefault(); endTutorial(); return true; });
  $('tutorial-skip').addEventListener('click', endTutorial);
  card.addEventListener('click', e => e.stopPropagation());
  next.addEventListener('click', showNext);
  back.addEventListener('click', () => { if (!busy && index > 0) go(index - 1); });
  replay.addEventListener('click', openTutorial);
  if (!seen) openTutorial();
})();
