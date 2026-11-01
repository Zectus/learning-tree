/* Subject discovery: a stable, weighted SVG treemap plus an equivalent outline.
   A collection leaf is a scope. Adding it saves a draft in the existing library;
   the existing AI tree designer supplies its eventual learning-node structure. */
const mathItems = new Map();
const MATH_STAGES = { elementary:'Elementary', secondary:'Secondary', university:'University', advanced:'Upper undergraduate', graduate:'Graduate' };
const MATH_COLORS = ['#73aa91','#c09bcb','#d2ad78','#83a8d0','#b6ae72','#bc9687','#83b7bb','#c894a2','#9b9bce','#a0b48b'];
function indexMathCollection(node, parent = null, family = 0) {
  node.parent = parent;
  node.family = family;
  node.path = parent ? [...parent.path, node.name] : [node.name];
  node.depth = parent ? parent.depth + 1 : 0;
  node.count = 0;
  mathItems.set(node.id, node);
  if (node.children) {
    node.children.forEach((child, i) => { indexMathCollection(child, node, parent ? family : i); node.count += child.count; });
  } else node.count = 1;
}
indexMathCollection(MATH_COLLECTION);
const mathAtlas = { focusId:MATH_COLLECTION.id, selectedId:null, view:'map', stage:'', camera:null, width:1200, height:800, returnTo:null, returnHash:'', busy:false };
let mathBuilderSelection = null;
const mathEl = id => document.getElementById(id);
const mathOwner = () => state.accountUser ? 'cloud:' + state.accountUser.uid : 'local';
const mathNormalize = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const mathIsOpen = () => mathEl('explorer-backdrop').classList.contains('open');
const mathEntry = id => Object.entries(libraryCache).find(([, entry]) => entry.data?.collectionId === id);
function mathMatchesStage(node) {
  return !mathAtlas.stage || (node.children ? node.children.some(mathMatchesStage) : node.stage === mathAtlas.stage);
}

// Balanced binary partitioning creates the map once per viewport aspect ratio.
// Navigation changes the camera, never the positions of subject regions.
function layoutMathRegions(node, x, y, w, h) {
  node.bounds = {x,y,w,h};
  if (!node.children) return;
  const pad = Math.min(w,h) * .025;
  const title = node.parent ? Math.min(h * .22, w * .4) : pad;
  node.headerHeight = title;
  const partition = (items, bx, by, bw, bh) => {
    if (items.length === 1) { layoutMathRegions(items[0], bx, by, bw, bh); return; }
    const total = items.reduce((sum,n) => sum + n.count, 0);
    let sum = items[0].count, split = 1;
    while (split < items.length - 1 && Math.abs(sum + items[split].count - total/2) < Math.abs(sum - total/2)) sum += items[split++].count;
    const fraction = sum / total;
    if (bw >= bh) {
      partition(items.slice(0,split), bx, by, bw*fraction, bh);
      partition(items.slice(split), bx+bw*fraction, by, bw*(1-fraction), bh);
    } else {
      partition(items.slice(0,split), bx, by, bw, bh*fraction);
      partition(items.slice(split), bx, by+bh*fraction, bw, bh*(1-fraction));
    }
  };
  partition(node.children, x+pad, y+title+pad, w-pad*2, h-title-pad*2);
}
layoutMathRegions(MATH_COLLECTION, 0, 0, mathAtlas.width, mathAtlas.height);
function mathMapSize() {
  const rect = mathEl('explorer-map').getBoundingClientRect();
  return {width:rect.width || 900, height:rect.height || 600};
}
function fitMathCamera(node) {
  const b = node.bounds, ratio = mathAtlas.width / mathAtlas.height;
  const w = Math.max(b.w*1.12, b.h*1.12*ratio);
  mathAtlas.camera = {x:b.x+b.w/2-w/2, y:b.y+b.h/2-w/ratio/2, w, h:w/ratio};
  renderMathMap();
}
function mathLabelLines(name, maxChars, maxLines) {
  const lines = [], words = name.split(' ');
  let line = '';
  for (const word of words) {
    if (line && (line+' '+word).length > maxChars) { lines.push(line); line = word; }
    else line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  const clipped = lines.map(text => text.length > maxChars ? text.slice(0,maxChars-1)+'…' : text);
  if (clipped.length > maxLines) return [...clipped.slice(0,maxLines-1), clipped[maxLines-1].slice(0,Math.max(1,maxChars-1))+'…'];
  return clipped;
}
function renderMathMap() {
  if (!mathAtlas.camera) return;
  const svg = mathEl('explorer-map'), camera = mathAtlas.camera;
  const size = mathMapSize(), scale = size.width / camera.w, font = 13/scale;
  svg.setAttribute('viewBox', `${camera.x} ${camera.y} ${camera.w} ${camera.h}`);
  const pieces = [];
  for (const node of mathItems.values()) {
    if (!node.parent) continue;
    const b = node.bounds, sw = b.w*scale, sh = b.h*scale;
    if (sw < 34 || sh < 24 || b.x > camera.x+camera.w || b.y > camera.y+camera.h || b.x+b.w < camera.x || b.y+b.h < camera.y) continue;
    // Ancestor headers should not float across the camera when deeply zoomed.
    const ancestor = mathItems.get(mathAtlas.focusId).path.length > node.path.length && mathItems.get(mathAtlas.focusId).path.slice(0,node.path.length).join('/') === node.path.join('/');
    if (ancestor) continue;
    const selected = node.id === mathAtlas.selectedId;
    const matching = mathMatchesStage(node);
    const opacity = node.children ? .15 + Math.min(node.depth,3)*.02 : .29;
    pieces.push(`<g data-math-id="${node.id}" role="button" tabindex="${node.parent.id === mathAtlas.focusId || selected ? '0' : '-1'}" aria-label="${svEsc(node.name + ', ' + (node.children ? t('{n} learning trees',{n:node.count}) : t(MATH_STAGES[node.stage])))}" class="${selected ? 'math-selected' : ''} ${matching ? '' : 'explorer-dim'}"><title>${svEsc(node.name)}</title><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${Math.min(6/scale,b.w*.02,b.h*.02)}" style="fill:${MATH_COLORS[node.family]};fill-opacity:${opacity}"/>`);
    const labelH = node.children ? node.headerHeight*scale : sh;
    const nearFocus = node.depth <= mathItems.get(mathAtlas.focusId).depth+1;
    if (sw > 70 && labelH > 24 && (nearFocus || (sw > 240 && sh > 150))) {
      const pad = 8/scale, maxChars = Math.max(6,Math.floor((sw-16)/7));
      const lines = mathLabelLines(node.name, maxChars, node.children ? Math.min(3,Math.floor((labelH-8)/16)) : Math.min(4,Math.floor((sh-16)/16)));
      pieces.push(`<text x="${b.x+pad}" y="${b.y+pad+font}" font-size="${font}" font-weight="${node.children ? 600 : 500}">`);
      lines.forEach((line,i) => pieces.push(`<tspan x="${b.x+pad}" dy="${i ? font*1.25 : 0}">${svEsc(line)}</tspan>`));
      pieces.push('</text>');
    }
    pieces.push('</g>');
  }
  svg.innerHTML = pieces.join('');
}
function zoomMathCamera(factor, px, py) {
  const c = mathAtlas.camera;
  if (!c) return;
  const size = mathMapSize();
  const fx = px === undefined ? .5 : px/size.width, fy = py === undefined ? .5 : py/size.height;
  const w = Math.max(mathAtlas.width/100, Math.min(mathAtlas.width*1.3,c.w/factor));
  const h = w*mathAtlas.height/mathAtlas.width;
  mathAtlas.camera = {x:c.x+c.w*fx-w*fx, y:c.y+c.h*fy-h*fy, w,h};
  clampMathCamera();
  renderMathMap();
}
function clampMathCamera() {
  const c = mathAtlas.camera;
  c.x = Math.max(-c.w*.8,Math.min(mathAtlas.width-c.w*.2,c.x));
  c.y = Math.max(-c.h*.8,Math.min(mathAtlas.height-c.h*.2,c.y));
}
function updateMathLink() {
  if (!mathIsOpen()) return;
  const url = new URL(location.href);
  url.hash = 'explore=' + (mathAtlas.selectedId || mathAtlas.focusId);
  history.replaceState(history.state, '', url);
}
function focusMathItem(id, moveFocus = false) {
  const node = mathItems.get(id);
  if (!node) return;
  mathAtlas.selectedId = node.children ? null : id;
  mathAtlas.focusId = node.children ? id : node.parent.id;
  mathEl('explorer-results').hidden = true;
  fitMathCamera(node);
  renderMathExplorer();
  updateMathLink();
  if (moveFocus) mathEl('explorer-detail-title').focus();
  if (window.innerWidth <= 760) {
    const panel = node.children ? mathEl('explorer-map-wrap').parentElement : mathEl('explorer-detail');
    panel.scrollIntoView?.({block:'start',behavior:'smooth'});
  }
}
function renderMathBreadcrumbs() {
  const focus = mathItems.get(mathAtlas.selectedId || mathAtlas.focusId), chain = [];
  for (let node=focus; node; node=node.parent) chain.unshift(node);
  mathEl('explorer-breadcrumbs').innerHTML = chain.map((node,i) => `${i ? '<span aria-hidden="true">›</span>' : ''}<button data-math-id="${node.id}" ${i === chain.length-1 ? 'aria-current="page"' : ''}>${svEsc(node.name)}</button>`).join('');
}
function renderMathDetail() {
  const node = mathItems.get(mathAtlas.selectedId || mathAtlas.focusId);
  const branch = !!node.children;
  const entry = branch ? null : mathEntry(node.id);
  const built = entry?.[1].data.nodes?.length > 0;
  mathEl('explorer-detail').innerHTML = `
    <p class="explorer-detail-kicker">${uiHTML(branch ? 'Subject region' : 'Learning tree')}</p>
    <h3 id="explorer-detail-title" tabindex="-1">${svEsc(node.name)}</h3>
    <p class="explorer-detail-path">${svEsc(node.path.slice(0,-1).join(' › '))}</p>
    <span class="explorer-stage-badge">${branch ? uiHTML('{n} learning trees',{n:node.count}) : uiHTML(MATH_STAGES[node.stage])}</span>
    <p class="explorer-description">${branch ? uiHTML('This region encompasses all the learning trees beneath it. Choose a smaller region to look closer.') : svEsc(node.scope)}</p>
    ${branch ? `<ul class="explorer-children">${node.children.map(child => `<li><button data-math-id="${child.id}"><span>${svEsc(child.name)}</span><span>${child.children ? child.count+' →' : '↗'}</span></button></li>`).join('')}</ul>` : `
    <p class="explorer-note">${uiHTML('A focused learning block, roughly 4–6 weeks at this level. Prerequisites are learned in other trees.')}</p>
    <div class="explorer-detail-actions">
      ${entry ? `<span class="explorer-saved-label">${uiHTML('✓ In My Trees')}</span>` : ''}
      <button id="explorer-tree-action" class="btn explorer-primary" ${mathAtlas.busy ? 'disabled' : ''}>${uiHTML(mathAtlas.busy ? 'Saving…' : !entry ? 'Add to my trees' : built ? 'Open tree' : 'Build tree')}</button>
      <button id="explorer-related" class="btn" data-math-id="${node.parent.id}">${uiHTML('Explore nearby trees')}</button>
    </div>
    <p class="explorer-note">${uiHTML(built ? 'Open your saved tree to continue learning.' : 'This collection defines the scope. Build its topic structure with the tree designer, then generate lessons when you are ready.')}</p>`}`;
  mathEl('explorer-tree-action')?.addEventListener('click', async () => {
    if (mathAtlas.busy) return;
    const current = mathEntry(node.id);
    if (!current) { await addMathTreeToLibrary(node.id); return; }
    const returnTo = mathAtlas.returnTo;
    closeMathAtlas(false);
    if (current[1].data.nodes?.length) openLibraryEntry(current[0]);
    else openMathTreeBuilder(node.id, current[0], returnTo);
  });
}
function renderMathOutline() {
  const focus = mathItems.get(mathAtlas.focusId);
  const items = focus.children.filter(mathMatchesStage);
  mathEl('explorer-outline').innerHTML = items.length ? items.map(node => `<button class="explorer-outline-item" data-math-id="${node.id}"><span><strong>${svEsc(node.name)}</strong><small>${node.children ? uiHTML('{n} learning trees',{n:node.count}) : svEsc(node.scope)}</small></span><span>${node.children ? '→' : uiHTML(MATH_STAGES[node.stage])}</span></button>`).join('') : `<p class="explorer-no-results">${uiHTML('No trees at this stage here. Choose another stage or go up a level.')}</p>`;
}
function renderMathExplorer() {
  renderMathBreadcrumbs();
  renderMathDetail();
  renderMathOutline();
  renderMathMap();
  const count = [...mathItems.values()].filter(node => !node.children && mathMatchesStage(node)).length;
  uiText(mathEl('explorer-count'), t('{n} learning trees',{n:count}));
  mathEl('explorer-map-wrap').hidden = mathAtlas.view !== 'map';
  mathEl('explorer-outline').hidden = mathAtlas.view !== 'outline';
  mathEl('explorer-map-tab').setAttribute('aria-pressed', String(mathAtlas.view === 'map'));
  mathEl('explorer-outline-tab').setAttribute('aria-pressed', String(mathAtlas.view === 'outline'));
  mathEl('explorer-up').disabled = mathAtlas.focusId === MATH_COLLECTION.id && !mathAtlas.selectedId;
}
function searchMathCollection() {
  const query = mathNormalize(mathEl('explorer-search').value.trim());
  const results = mathEl('explorer-results');
  if (!query) { results.hidden = true; return; }
  const words = query.split(/\s+/);
  const found = [...mathItems.values()].filter(node => {
    const text = mathNormalize(node.path.join(' ')+' '+(node.scope || ''));
    return mathMatchesStage(node) && words.every(word => text.includes(word));
  }).sort((a,b) => Number(mathNormalize(b.name) === query)-Number(mathNormalize(a.name) === query) || Number(mathNormalize(b.name).startsWith(query))-Number(mathNormalize(a.name).startsWith(query)) || a.depth-b.depth);
  results.innerHTML = found.length ? found.map(node => `<button class="explorer-result" data-math-id="${node.id}"><strong>${svEsc(node.name)}</strong><span>${svEsc(node.path.slice(0,-1).join(' › '))}</span><span>${node.children ? uiHTML('{n} learning trees',{n:node.count}) : uiHTML(MATH_STAGES[node.stage])}</span></button>`).join('') : `<p class="explorer-no-results" role="status">${uiHTML('No matching subjects. Try another word or stage.')}</p>`;
  results.hidden = false;
}
async function addMathTreeToLibrary(id) {
  const node = mathItems.get(id);
  if (!node || node.children || mathAtlas.busy) return null;
  mathAtlas.busy = true;
  renderMathDetail();
  try {
    if (!libraryReady) await refreshLibraryFromSource();
    if (!libraryReady) return null;
    const existing = mathEntry(id);
    if (existing) return existing[0];
    const cache = libraryCache, owner = mathOwner(), libraryId = genLibraryId();
    cache[libraryId] = {name:node.name, savedAt:Date.now(), data:{topic:node.name, collectionId:id, nodes:[]}};
    const saved = await persistLibrary();
    if (!saved) { delete cache[libraryId]; return null; }
    if (cache !== libraryCache || owner !== mathOwner()) return null;
    showToast(t('Added "{name}" to My Trees.',{name:node.name}));
    renderLibraryGrid();
    return libraryId;
  } finally { mathAtlas.busy = false; if (mathIsOpen()) renderMathDetail(); }
}
function resetMathTreeBuilder() {
  mathBuilderSelection = null;
  mathEl('tree-collection-scope').classList.add('hidden');
}
function openMathTreeBuilder(id, libraryId, returnTo = 'library') {
  const node = mathItems.get(id);
  if (!node || node.children) return;
  openTreeModal();
  mathBuilderSelection = {id, libraryId, owner:mathOwner(), returnTo};
  mathEl('tree-topic-input').value = node.name;
  mathEl('tree-collection-description').textContent = node.scope;
  mathEl('tree-collection-scope').classList.remove('hidden');
  updateTreePromptPreview();
}
function mathCollectionPrompt(topic) {
  const node = mathItems.get(mathBuilderSelection?.id);
  if (!node || node.name !== topic) return '';
  return `\n\nMATHEMATICS COLLECTION SCOPE\nSubject path: ${node.path.join(' > ')}\nIntended stage: ${MATH_STAGES[node.stage]}\nScope: ${node.scope}\n\nDesign only this focused learning block, roughly 4–6 weeks at the stated level, rather than its parent subject. Keep the calibration in the main instructions, then use it to decide which assumed background needs attention without expanding the destination beyond this scope. The surrounding subject hierarchy is organizational, not a prerequisite chain.\nKeep the top-level topic exactly ${JSON.stringify(node.name)} and include the top-level field "collectionId": ${JSON.stringify(node.id)} in the output JSON so it returns to this saved collection tree.\n`;
}
function resolveMathCollectionImport(obj) {
  const candidate = mathItems.get(mathBuilderSelection?.id);
  const selected = candidate && mathBuilderSelection.owner === mathOwner() && mathEl('tree-topic-input').value.trim() === candidate.name && !mathEl('tree-mode-topic-panel').classList.contains('hidden') ? candidate : null;
  const supplied = mathItems.get(obj.collectionId);
  const node = supplied && !supplied.children ? supplied : selected;
  return node && node.name === String(obj.topic || '').trim() ? node.id : null;
}
document.addEventListener('tree-loaded', () => {
  const selection = mathBuilderSelection;
  if (!selection || selection.id !== state.collectionId || selection.owner !== mathOwner()) return;
  const entry = libraryCache[selection.libraryId];
  if (!entry || entry.data.collectionId !== selection.id) return;
  state.libraryId = selection.libraryId;
  const before = {data:entry.data,savedAt:entry.savedAt}, snapshot = buildTreeJSON(true);
  entry.data = snapshot;
  entry.savedAt = Date.now();
  void persistLibrary().then(ok => {
    if (!ok && libraryCache[selection.libraryId] === entry && entry.data === snapshot) Object.assign(entry,before);
    renderLibraryGrid();
  });
});
function resizeMathAtlas() {
  if (!mathIsOpen() || mathAtlas.view !== 'map') return;
  const size = mathMapSize(), height = mathAtlas.width*size.height/size.width;
  if (Math.abs(height-mathAtlas.height) < 1) return;
  mathAtlas.height = height;
  layoutMathRegions(MATH_COLLECTION,0,0,mathAtlas.width,height);
  fitMathCamera(mathItems.get(mathAtlas.selectedId || mathAtlas.focusId));
}
function openMathAtlas({target, returnTo} = {}) {
  if (!mathIsOpen()) {
    mathAtlas.returnTo = returnTo || (mathEl('library-modal-backdrop').classList.contains('open') ? 'library' : null);
    mathAtlas.returnHash = location.hash;
  }
  closeLibraryModal();
  mathEl('explorer-backdrop').classList.add('open');
  if (target && mathItems.has(target) && target !== (mathAtlas.selectedId || mathAtlas.focusId)) focusMathItem(target);
  if (!mathAtlas.camera) fitMathCamera(MATH_COLLECTION);
  renderMathExplorer();
  resizeMathAtlas();
  updateMathLink();
  if (!mathEl('explorer-search').value) mathEl('explorer-search').focus();
  else { mathEl('explorer-title').tabIndex=-1; mathEl('explorer-title').focus(); }
}
function closeMathAtlas(restore = true) {
  if (!mathIsOpen()) return;
  mathEl('explorer-backdrop').classList.remove('open');
  mathEl('explorer-results').hidden = true;
  const url = new URL(location.href);
  url.hash = mathAtlas.returnHash;
  history.replaceState(history.state,'',url);
  if (restore && mathAtlas.returnTo === 'library') void openLibraryModal();
}
mathEl('btn-explore-trees').addEventListener('click', () => openMathAtlas());
mathEl('menu-explore-trees').addEventListener('click', () => openMathAtlas({target:state.collectionId || [...mathItems.values()].find(n => !n.children && n.name === state.topic)?.id}));
mathEl('explorer-close').addEventListener('click', () => closeMathAtlas());
mathEl('explorer-library').addEventListener('click', () => { closeMathAtlas(false); void openLibraryModal(); });
mathEl('explorer-backdrop').addEventListener('click', e => { if (e.target === mathEl('explorer-backdrop')) closeMathAtlas(); });
mathEl('explorer-shell').addEventListener('click', e => {
  const target = e.target.closest('[data-math-id]');
  if (target && !target.closest('svg')) focusMathItem(target.dataset.mathId, true);
});
mathEl('explorer-search').addEventListener('input', searchMathCollection);
mathEl('explorer-search').addEventListener('focus', searchMathCollection);
mathEl('explorer-stage').addEventListener('change', e => { mathAtlas.stage=e.target.value; renderMathExplorer(); searchMathCollection(); });
mathEl('explorer-shell').addEventListener('keydown', e => {
  const results = [...mathEl('explorer-results').querySelectorAll('button')];
  if (e.key === 'ArrowDown' && (e.target.id === 'explorer-search' || e.target.closest('#explorer-results'))) {
    e.preventDefault(); results[(results.indexOf(e.target)+1)%results.length]?.focus();
  } else if (e.key === 'ArrowUp' && e.target.closest('#explorer-results')) {
    e.preventDefault(); const i=results.indexOf(e.target); (i > 0 ? results[i-1] : mathEl('explorer-search')).focus();
  } else if (e.key === 'Enter' && e.target.id === 'explorer-search' && !mathEl('explorer-results').hidden && results[0]) {
    e.preventDefault(); focusMathItem(results[0].dataset.mathId,true);
  }
});
for (const view of ['map','outline']) mathEl(`explorer-${view}-tab`).addEventListener('click', () => {
  mathAtlas.view=view; renderMathExplorer(); resizeMathAtlas();
});
mathEl('explorer-up').addEventListener('click', () => {
  const node = mathItems.get(mathAtlas.selectedId || mathAtlas.focusId);
  if (node.parent) focusMathItem(node.parent.id);
});
mathEl('explorer-fit').addEventListener('click', () => fitMathCamera(mathItems.get(mathAtlas.selectedId || mathAtlas.focusId)));
mathEl('explorer-zoom-in').addEventListener('click', () => zoomMathCamera(1.5));
mathEl('explorer-zoom-out').addEventListener('click', () => zoomMathCamera(1/1.5));
mathEl('tree-back-to-atlas').addEventListener('click', () => {
  const selection = mathBuilderSelection;
  closeTreeModal();
  if (selection) openMathAtlas({target:selection.id,returnTo:selection.returnTo});
});
onEscape(110, () => {
  if (!mathIsOpen()) return false;
  if (!mathEl('explorer-results').hidden) { mathEl('explorer-search').focus(); mathEl('explorer-results').hidden=true; }
  else closeMathAtlas();
  return true;
});
document.addEventListener('ui-language-change', () => { if (mathIsOpen()) { renderMathExplorer(); searchMathCollection(); } });
document.addEventListener('library-updated', () => { if (mathIsOpen()) renderMathDetail(); });
window.addEventListener('resize', resizeMathAtlas);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeMathAtlas).observe(mathEl('explorer-map-wrap'));

// Pointer capture supports mouse, pen, touch panning and two-finger pinch.
(() => {
  const svg=mathEl('explorer-map'), points=new Map();
  let start=null, moved=false, tapId=null, lastPointerUp=-Infinity;
  function startGesture() {
    const p=[...points.values()];
    if (!p.length) { start=null; return; }
    const center=p.length>1 ? {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2} : p[0];
    start={camera:{...mathAtlas.camera},center,distance:p.length>1 ? Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y) : 0};
  }
  svg.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if (points.size===1) { moved=false; tapId=e.target.closest('[data-math-id]')?.dataset.mathId; }
    else moved=true;
    svg.setPointerCapture?.(e.pointerId); startGesture();
  });
  svg.addEventListener('pointermove', e => {
    if (!points.has(e.pointerId) || !start) return;
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const p=[...points.values()], center=p.length>1 ? {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2} : p[0];
    if (Math.hypot(center.x-start.center.x,center.y-start.center.y)>4) moved=true;
    const size=mathMapSize(), c=start.camera;
    const ratio=start.distance && p.length>1 ? Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)/start.distance : 1;
    const w=Math.max(mathAtlas.width/100,Math.min(mathAtlas.width*1.3,c.w/Math.max(.01,ratio))), h=w*mathAtlas.height/mathAtlas.width;
    const rect=svg.getBoundingClientRect(), fx=(start.center.x-rect.left)/size.width, fy=(start.center.y-rect.top)/size.height;
    mathAtlas.camera={x:c.x+c.w*fx-w*fx-(center.x-start.center.x)*w/size.width,y:c.y+c.h*fy-h*fy-(center.y-start.center.y)*h/size.height,w,h};
    clampMathCamera(); renderMathMap();
  });
  function end(e) {
    if (!points.has(e.pointerId)) return;
    const tap=points.size===1 && !moved && e.type!=='pointercancel' && tapId;
    points.delete(e.pointerId); if (svg.hasPointerCapture?.(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    lastPointerUp=performance.now(); startGesture();
    if (tap) focusMathItem(tap);
  }
  svg.addEventListener('pointerup',end); svg.addEventListener('pointercancel',end);
  svg.addEventListener('lostpointercapture', e => { points.delete(e.pointerId); startGesture(); });
  svg.addEventListener('click', e => { if (performance.now()-lastPointerUp>350) { const id=e.target.closest('[data-math-id]')?.dataset.mathId; if(id) focusMathItem(id); } });
  svg.addEventListener('keydown', e => {
    const id=e.target.closest('[data-math-id]')?.dataset.mathId;
    if (id && (e.key==='Enter' || e.key===' ')) { e.preventDefault(); focusMathItem(id,true); }
  });
  svg.addEventListener('wheel', e => {
    e.preventDefault(); const rect=svg.getBoundingClientRect();
    const unit=e.deltaMode===1 ? 20 : e.deltaMode===2 ? 400 : 1;
    zoomMathCamera(Math.exp(-Math.max(-200,Math.min(200,e.deltaY*unit))*.003),e.clientX-rect.left,e.clientY-rect.top);
  },{passive:false});
})();
const mathLinkedId=new URLSearchParams(location.hash.slice(1)).get('explore');
if (mathItems.has(mathLinkedId)) { openMathAtlas({target:mathLinkedId}); mathAtlas.returnHash=''; }
