/* ═══════════════════════════════════════════════════════════
   catalog.js — lazy loader for built-in static trees under catalog/.
   Nothing in catalog/ is downloaded on initial page load:
     1. catalog/index.json (~3 KB) loads when Explore trees or My Trees
        needs to know which collection subjects have built-in trees.
     2. catalog/<dir>/tree.json (~5-15 KB) loads only when the user opens
        that built-in tree.
     3. catalog/<dir>/lessons/<nodeId>.txt (~5-15 KB) loads only when the
        user opens (or hovers) a specific node with a built-in lesson.

   Built-in trees save as lightweight pointer entries in My Trees
   ({ builtinId }) instead of duplicating full tree/lesson payloads into
   localStorage or Firebase. If the user edits the tree, library.js forks
   it into a normal full snapshot automatically (copy-on-write).

   Depends on state.js, io.js (loadFromJSON, buildTreeJSON), nodes.js
   (refreshNodeLessonIndicator), viewer.js (continueViewer), toast.js.
═══════════════════════════════════════════════════════════ */
const CATALOG_INDEX_URL = 'catalog/index.json';

let catalogIndex = null;
let catalogIndexPromise = null;
const catalogTreeCache = new Map();   // id → Promise<treeObj>
const catalogLessonCache = new Map(); // "id::slug" → Promise<string>

function catalogDirFor(id, meta) {
  return (meta && meta.dir) || id;
}

function catalogVersionSuffix(meta) {
  return meta && meta.v != null ? `?v=${encodeURIComponent(meta.v)}` : '';
}

function catalogLocaleFor(meta) {
  const lang = typeof uiLanguage === 'string' ? uiLanguage : 'en';
  if (lang !== 'en' && meta?.locales && Object.hasOwn(meta.locales, lang)) return lang;
  return 'en';
}

function getCatalogSignature(meta) {
  if (!meta) return null;
  const locale = catalogLocaleFor(meta);
  return (locale !== 'en' ? meta.locales?.[locale]?.signature : null) || meta.signature || null;
}

function getCatalogEntry(id) {
  if (!id || !catalogIndex?.trees) return null;
  return Object.hasOwn(catalogIndex.trees, id) ? catalogIndex.trees[id] : null;
}

function loadCatalogIndex() {
  if (catalogIndex) return Promise.resolve(catalogIndex);
  if (catalogIndexPromise) return catalogIndexPromise;
  if (typeof fetch !== 'function') {
    catalogIndex = { version: 1, trees: {} };
    return Promise.resolve(catalogIndex);
  }
  catalogIndexPromise = fetch(CATALOG_INDEX_URL)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      catalogIndex = (data && typeof data === 'object' && data.trees && typeof data.trees === 'object')
        ? data
        : { version: 1, trees: {} };
      document.dispatchEvent(new CustomEvent('catalog-loaded'));
      return catalogIndex;
    })
    .catch(() => {
      // Offline, file://, or test environments without an HTTP server degrade cleanly.
      catalogIndexPromise = null;
      return { version: 1, trees: {} };
    });
  return catalogIndexPromise;
}

function fetchBuiltinTree(id, locale) {
  const meta = getCatalogEntry(id);
  if (!meta) return Promise.reject(new Error(`No built-in tree for ${id}`));
  const loc = locale || catalogLocaleFor(meta);
  const cacheKey = `${id}@${meta.v ?? 1}::${loc}`;
  if (!catalogTreeCache.has(cacheKey)) {
    const fileName = loc === 'en' ? 'tree.json' : `tree.${encodeURIComponent(loc)}.json`;
    const url = `catalog/${catalogDirFor(id, meta)}/${fileName}${catalogVersionSuffix(meta)}`;
    const p = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch(err => {
        catalogTreeCache.delete(cacheKey);
        throw err;
      });
    catalogTreeCache.set(cacheKey, p);
  }
  return catalogTreeCache.get(cacheKey).then(raw => {
    const subjectName = typeof mathItems !== 'undefined' ? mathItems.get(id)?.name : null;
    return {
      ...raw,
      topic: raw.topic || subjectName || '',
      collectionId: id,
    };
  });
}

function fetchBuiltinLesson(builtinId, slug, locale) {
  const meta = getCatalogEntry(builtinId);
  if (!meta) return Promise.reject(new Error(`No built-in tree for ${builtinId}`));
  const loc = locale || catalogLocaleFor(meta);
  const cacheKey = `${builtinId}@${meta.v ?? 1}::${loc}::${slug}`;
  if (!catalogLessonCache.has(cacheKey)) {
    const lessonPath = loc === 'en'
      ? `lessons/${encodeURIComponent(slug)}.txt`
      : `lessons/${encodeURIComponent(loc)}/${encodeURIComponent(slug)}.txt`;
    const url = `catalog/${catalogDirFor(builtinId, meta)}/${lessonPath}${catalogVersionSuffix(meta)}`;
    const p = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .catch(err => {
        catalogLessonCache.delete(cacheKey);
        throw err;
      });
    catalogLessonCache.set(cacheKey, p);
  }
  return catalogLessonCache.get(cacheKey);
}

function builtinStructureKey(data) {
  if (!data) return '';
  const nodes = (data.nodes || []).map(n => ({
    id: String(n.id), label: n.label, explanation: n.explanation || '',
    optional: !!n.optional,
    requires: [...(n.requires || [])].map(String).sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({ topic: data.topic || '', language: data.language || '', collectionId: data.collectionId || '', nodes });
}

// True while the live canvas still matches the built-in tree as loaded (allowing
// lazy-loaded built-in lessons that haven't been replaced or deleted by the user).
function isUnmodifiedBuiltinTree() {
  if (!state.builtinId || !state.builtinBaseKey) return false;
  const current = buildTreeJSON(false);
  if (!current || builtinStructureKey(current) !== state.builtinBaseKey) return false;
  for (const node of state.nodes.values()) {
    const bl = node._builtinLesson;
    if (bl) {
      if (node._sessionTxt && node._sessionTxt !== bl.loadedTxt) return false;
    } else if (node._sessionTxt) {
      return false;
    }
  }
  return true;
}

async function openBuiltinTree(id, libraryId = null) {
  await loadCatalogIndex();
  const meta = getCatalogEntry(id);
  if (!meta) {
    showToast("Couldn't find this built-in tree.");
    return false;
  }
  const locale = catalogLocaleFor(meta);
  let treeData;
  try {
    treeData = await fetchBuiltinTree(id, locale);
  } catch (e) {
    console.error('Could not load built-in tree:', e);
    showToast("Couldn't load this tree — check your connection and try again.");
    return false;
  }
  if (typeof preserveCurrentTreeBeforeReplace === 'function') preserveCurrentTreeBeforeReplace();
  if (!loadFromJSON(treeData)) return false;
  const rawLessons = locale !== 'en' ? meta.locales?.[locale]?.lessons : meta.lessons;
  const lessonSet = new Set(Array.isArray(rawLessons) ? rawLessons : []);
  state.collectionId = id;
  state.builtinId = id;
  state.builtinVersion = meta.v ?? 1;
  state.builtinBaseKey = builtinStructureKey(buildTreeJSON(false));
  state.nodes.forEach(node => {
    if (lessonSet.has(node.slug) && !node._sessionTxt) {
      node._builtinLesson = { builtinId: id, slug: node.slug, locale, loadedTxt: null };
      refreshNodeLessonIndicator(node);
    }
  });
  if (libraryId) state.libraryId = libraryId;
  return true;
}

function prefetchBuiltinNodeLesson(node) {
  if (!node?._builtinLesson || node._sessionTxt) return;
  const { builtinId, slug, locale } = node._builtinLesson;
  fetchBuiltinLesson(builtinId, slug, locale).then(txt => {
    if (node._builtinLesson && !node._sessionTxt) {
      node._builtinLesson.loadedTxt = txt;
    }
  }).catch(() => {});
}

async function openBuiltinNodeLesson(node) {
  if (!node?._builtinLesson) return;
  if (node._sessionTxt) { continueViewer(node.id); return; }
  const { builtinId, slug, locale } = node._builtinLesson;
  try {
    const txt = node._builtinLesson.loadedTxt || await fetchBuiltinLesson(builtinId, slug, locale);
    if (!state.nodes.has(node.id) || state.nodes.get(node.id) !== node) return;
    node._builtinLesson.loadedTxt = txt;
    node._sessionTxt = txt;
    continueViewer(node.id);
  } catch (e) {
    console.error('Could not load built-in lesson:', e);
    showToast("Couldn't load this lesson — check your connection and try again.");
  }
}
