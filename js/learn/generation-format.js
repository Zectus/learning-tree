/* Shared browser/Node lesson identity and validation. No DOM or dependencies. */
// Identity excludes content, node order, and personal progress. Editing a scope,
// label, language, or prerequisite makes old output ineligible for this tree.
function generationTreeKey(tree) {
  const canonical = JSON.stringify({
    topic: tree.topic || '', language: tree.language || '', isSpanish: tree.isSpanish === true,
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

// A shared structural check used by browser imports and the local companion.
// It validates recoverable lesson syntax, not subject accuracy or pedagogy.
function lessonIsComplete(content) {
  if (typeof content !== 'string' || !/^===\s*(?:SECTION|SECCI[OÓ]N)\s+1[:.]\s*.+?\s*===/i.test(content.trim())) return false;
  const stack = [], ids = new Set();
  for (const [, closing, tagRaw, number] of content.matchAll(/\[(\/?)(QUESTION|BONUS|TABLE|TIMELINE|GRAPH)(?:\s+(\d+))?\]/gi)) {
    const tag = tagRaw.toUpperCase();
    if (closing) { if (stack.pop() !== tag) return false; }
    else {
      if (tag === 'QUESTION' || tag === 'BONUS') {
        if (!number || Number(number) < 1 || ids.has(tag + ':' + Number(number))) return false;
        ids.add(tag + ':' + Number(number));
      }
      stack.push(tag);
    }
  }
  if (stack.length || ![...ids].some(id => id.startsWith('QUESTION:'))) return false;
  for (const [, body] of content.matchAll(/\[(?:QUESTION|BONUS)\s+\d+\]([\s\S]*?)\[\/(?:QUESTION|BONUS)\]/gi)) {
    const answers = [...body.matchAll(/\[ANSWER:\s*([A-E])\]/gi)];
    if (answers.length !== 1) return false;
    const choices = [...body.matchAll(/^\(([A-E])\)[\t ]+([^\r\n]*)/gim)];
    const letters = choices.map(m => m[1].toUpperCase());
    if (choices.length < 2 || new Set(letters).size !== letters.length || choices.some(m => !m[2].trim()) || !letters.includes(answers[0][1].toUpperCase())) return false;
    const question = body.replace(/\[ANSWER:[^\]]+\]/gi, '').replace(/^\([A-E]\)[\t ]+[^\r\n]*/gim, '').trim();
    if (!question) return false;
  }
  return true;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { generationTreeKey, lessonIsComplete };
