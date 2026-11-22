/* Shared browser/Node lesson identity and validation. No DOM or dependencies. */
// Identity excludes content, node order, and personal progress. Editing a scope,
// label, language, or prerequisite makes old output ineligible for this tree.
function generationTreeKey(tree) {
  const canonical = JSON.stringify({
    topic: tree.topic || '', language: tree.language || '',
    nodes: tree.nodes.map(n => ({
      id: String(n.id), label: n.label, explanation: n.explanation || '',
      optional: !!n.optional, requires: [...new Set(n.requires || [])].map(String).sort(),
    })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  });
  // Two deterministic 32-bit hashes detect accidental mismatches, not authenticity.
  let a = 2166136261, b = 5381;
  for (let i = 0; i < canonical.length; i++) {
    a = Math.imul(a ^ canonical.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ canonical.charCodeAt(i);
  }
  return 'lt1-' + (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

// Shared structural validator used by browser imports and single-lesson paste.
// Validates recoverable lesson syntax and block shapes, not subject accuracy.
const VALID_GRAPH_TYPES = new Set(['function2d', 'parametric2d', 'surface3d', 'vectorfield2d']);
const VALID_CALLOUT_TONES_FMT = new Set(['key', 'note', 'caution']);
const CALLOUT_HEADER_LINE_RE = /^(id|label|title|tone|collapsed):\s*(.*)$/i;

function validateLessonStructure(content) {
  const errors = [];
  if (typeof content !== 'string' || !content.trim()) {
    return { valid: false, errors: ['Lesson text is empty.'] };
  }
  if (!/^===\s*(?:SECTION|SECCI[OÓ]N)\s+1[:.]\s*.+?\s*===/i.test(content.trim())) {
    errors.push('Lesson must start with a "=== SECTION 1: Title ===" header.');
  }
  const stack = [], ids = new Set();
  for (const [, closing, tagRaw, number] of content.matchAll(/\[(\/?)(QUESTION|BONUS|TABLE|TIMELINE|GRAPH|CALLOUT)(?:\s+(\d+))?\]/gi)) {
    const tag = tagRaw.toUpperCase();
    if (closing) {
      const top = stack.pop();
      if (top !== tag) {
        errors.push(top ? `Expected [/${top}] before [/${tag}].` : `Unexpected closing [/${tag}] tag.`);
      }
    } else {
      if (tag === 'CALLOUT' && stack.some(parent => parent === 'CALLOUT' || parent === 'QUESTION' || parent === 'BONUS')) {
        errors.push(`[CALLOUT] cannot be nested inside [${stack[stack.length - 1]}].`);
      }
      if (tag === 'QUESTION' || tag === 'BONUS') {
        const num = Number(number);
        if (!number || num < 1) errors.push(`[${tag}] must have a positive number.`);
        else if (ids.has(tag + ':' + num)) errors.push(`Duplicate [${tag} ${num}] block.`);
        else ids.add(tag + ':' + num);
      }
      stack.push(tag);
    }
  }
  for (const open of stack) errors.push(`Unclosed [${open}] block.`);
  if (![...ids].some(id => id.startsWith('QUESTION:'))) {
    errors.push('Lesson must include at least one [QUESTION N] block.');
  }

  for (const [, kindRaw, num, body] of content.matchAll(/\[(QUESTION|BONUS)\s+(\d+)\]([\s\S]*?)\[\/(?:QUESTION|BONUS)\]/gi)) {
    const label = `[${kindRaw.toUpperCase()} ${num}]`;
    const answers = [...body.matchAll(/\[ANSWER:\s*([A-E])\]/gi)];
    if (answers.length !== 1) errors.push(`${label} must have exactly one [ANSWER: A-E] tag.`);
    const choices = [...body.matchAll(/^\(([A-E])\)[\t ]+([^\r\n]*)/gim)];
    const letters = choices.map(m => m[1].toUpperCase());
    if (choices.length < 2) errors.push(`${label} must have at least 2 answer options.`);
    if (new Set(letters).size !== letters.length) errors.push(`${label} has duplicate answer option letters.`);
    if (choices.some(m => !m[2].trim())) errors.push(`${label} has an empty answer option.`);
    if (answers.length === 1 && !letters.includes(answers[0][1].toUpperCase())) {
      errors.push(`${label} answer (${answers[0][1].toUpperCase()}) does not match any option.`);
    }
    const question = body.replace(/\[ANSWER:[^\]]+\]/gi, '').replace(/^\([A-E]\)[\t ]+[^\r\n]*/gim, '').trim();
    if (!question) errors.push(`${label} is missing its question text.`);
  }

  let graphIdx = 0;
  for (const [, body] of content.matchAll(/\[GRAPH\]([\s\S]*?)\[\/GRAPH\]/gi)) {
    graphIdx++;
    const label = `[GRAPH #${graphIdx}]`;
    const typeMatch = body.match(/^type:\s*(.+)$/im);
    const type = typeMatch ? typeMatch[1].trim().toLowerCase() : 'function2d';
    if (!VALID_GRAPH_TYPES.has(type)) {
      errors.push(`${label} has unsupported type "${type}".`);
    } else if ((type === 'function2d' || type === 'parametric2d') && !/^trace:\s*\S/im.test(body)) {
      errors.push(`${label} (${type}) requires at least one trace: line.`);
    } else if (type === 'surface3d' && !/^z:\s*\S/im.test(body)) {
      errors.push(`${label} (surface3d) requires a z: expression.`);
    } else if (type === 'vectorfield2d' && (!/^u:\s*\S/im.test(body) || !/^v:\s*\S/im.test(body))) {
      errors.push(`${label} (vectorfield2d) requires both u: and v: expressions.`);
    }
    for (const [, rk, rv] of body.matchAll(/^(xrange|yrange|trange):\s*(.+)$/gim)) {
      const parts = rv.split(',').map(s => Number(s.trim()));
      if (parts.length !== 2 || !parts.every(Number.isFinite) || parts[0] >= parts[1]) {
        errors.push(`${label} has invalid ${rk.toLowerCase()} "${rv.trim()}".`);
      }
    }
    for (const [, key, expr] of body.matchAll(/^(trace|z|u|v):\s*([^\r\n|]+)/gim)) {
      if (/\\[a-zA-Z()]/.test(expr)) {
        errors.push(`${label} ${key.toLowerCase()} expression must use plain ASCII math, not LaTeX.`);
      }
    }
  }

  let tableIdx = 0;
  for (const [, body] of content.matchAll(/\[TABLE\]([\s\S]*?)\[\/TABLE\]/gi)) {
    tableIdx++;
    const rows = body.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split(/\s\|\s/).length);
    if (rows.length < 2) errors.push(`[TABLE #${tableIdx}] must have a header and at least one data row.`);
    else if (rows.some(cols => cols !== rows[0])) errors.push(`[TABLE #${tableIdx}] rows have inconsistent column counts.`);
  }

  let calloutIdx = 0;
  const calloutAnchors = new Set();
  const seenCalloutIds = new Set();
  for (const [, rawBody] of content.matchAll(/\[CALLOUT\]([\s\S]*?)\[\/CALLOUT\]/gi)) {
    calloutIdx++;
    const label = `[CALLOUT #${calloutIdx}]`;
    const lines = rawBody.replace(/\r\n?/g, '\n').split('\n');
    let i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    let calloutId = '';
    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (!trimmed) { i++; break; }
      const m = trimmed.match(CALLOUT_HEADER_LINE_RE);
      if (!m) break;
      const key = m[1].toLowerCase(), val = m[2].trim();
      if (key === 'id') {
        if (!/^[a-z0-9_-]+$/i.test(val)) {
          errors.push(`${label} has invalid id "${val}" (use letters, numbers, "_" or "-").`);
        } else {
          const normId = val.toLowerCase();
          if (seenCalloutIds.has(normId)) errors.push(`${label} duplicates callout id "${normId}".`);
          else { seenCalloutIds.add(normId); calloutId = normId; }
        }
      } else if (key === 'tone' && !VALID_CALLOUT_TONES_FMT.has(val.toLowerCase())) {
        errors.push(`${label} has unsupported tone "${val}" (use key, note, or caution).`);
      } else if (key === 'collapsed' && !/^(true|false)$/i.test(val)) {
        errors.push(`${label} collapsed must be "true" or "false".`);
      }
      i++;
    }
    const bodyText = lines.slice(i).join('\n').trim();
    if (!bodyText) errors.push(`${label} is missing its body text.`);
    if (calloutId) {
      calloutAnchors.add(calloutId);
      // Mirror parseProseBlocks' numbered-item anchors (id.N) for (N) and N. lists.
      const bodyLines = bodyText.replace(/\[TABLE\][\s\S]*?\[\/TABLE\]/gi, '').split('\n');
      const parenNums = [], dotNums = [];
      for (const bl of bodyLines) {
        const t = bl.trim();
        const pm = t.match(/^\((\d{1,3})\)\s+\S/);
        if (pm) { parenNums.push(pm[1]); continue; }
        const dm = t.match(/^(\d{1,3})\.\s+\S/);
        if (dm) dotNums.push(dm[1]);
      }
      if (parenNums.length >= 2 || (parenNums.length === 1 && parenNums[0] === '1')) {
        parenNums.forEach(n => calloutAnchors.add(`${calloutId}.${n}`));
      }
      if (dotNums.length >= 2) {
        dotNums.forEach(n => calloutAnchors.add(`${calloutId}.${n}`));
      }
    }
  }

  for (const [, rawInner] of content.matchAll(/\[REF:([^\]]*)\]/gi)) {
    const inner = rawInner.trim();
    const pipeIdx = inner.indexOf('|');
    const targetRaw = (pipeIdx === -1 ? inner : inner.slice(0, pipeIdx)).trim();
    const visible = pipeIdx === -1 ? targetRaw : inner.slice(pipeIdx + 1).trim();
    if (!/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)?$/i.test(targetRaw)) {
      errors.push(`[REF:${rawInner}] has an invalid target id.`);
    } else if (!visible) {
      errors.push(`[REF: ${targetRaw}] is missing visible link text after "|".`);
    } else if (!calloutAnchors.has(targetRaw.toLowerCase())) {
      errors.push(`[REF: ${targetRaw}] does not match any [CALLOUT] id or numbered item.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function lessonIsComplete(content) {
  return validateLessonStructure(content).valid;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { generationTreeKey, lessonIsComplete, validateLessonStructure };
