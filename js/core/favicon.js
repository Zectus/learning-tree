/* Symbolic tab icon, following the canvas's left-to-right rounded node cards.
   Only required topics affect its size and completion. Depends on state.js. */
function treeIconSummary(nodes) {
  let total = 0, done = 0;
  for (const node of nodes) {
    if (node.optional) continue;
    total++;
    if (node.done) done++;
  }
  const size = total <= 5 ? 3 : total <= 20 ? 5 : 7;
  // Keep the final symbol neutral until the whole required tree is complete.
  const green = total ? Math.floor(done / total * size) : 0;
  return {size, green};
}

function renderTreeIcon({size, green}) {
  const nodes = size === 3
    ? [[6,32],[44,16],[44,48]]
    : size === 5
      ? [[2,32],[25,16],[25,48],[48,16],[48,48]]
      : [[2,32],[25,16],[25,48],[48,8],[48,24],[48,40],[48,56]];
  const edges = size === 3 ? [[0,1],[0,2]]
    : size === 5 ? [[0,1],[0,2],[1,3],[2,4]]
    : [[0,1],[0,2],[1,3],[1,4],[2,5],[2,6]];
  const nodeWidth = 14;
  const paths = edges.map(([from,to]) => {
    const [x,y] = nodes[from], [tx,ty] = nodes[to], start = x + nodeWidth;
    const mid = (start + tx) / 2;
    return `<path class="branch${to < green ? ' complete' : ''}" d="M${start} ${y} C${mid} ${y} ${mid} ${ty} ${tx} ${ty}"/>`;
  }).join('');
  const cards = nodes.map(([x,y],i) => `<rect class="topic${i < green ? ' complete' : ''}" x="${x}" y="${y-5}" width="${nodeWidth}" height="10" rx="3"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>
    .branch,.topic{stroke:#6c7973;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
    .branch{fill:none}.topic{fill:#f1f5f2}.complete{stroke:#28945b}.topic.complete{fill:#65bd87}
    @media(prefers-color-scheme:dark){.branch,.topic{stroke:#c3cdc7}.topic{fill:#252d29}.complete{stroke:#65bd87}.topic.complete{fill:#338958}}
  </style>${paths}${cards}</svg>`;
}

let treeIconKey = '';
function updateTreeIcon() {
  const summary = treeIconSummary(state.nodes.values());
  const key = `${summary.size}:${summary.green}`;
  if (key === treeIconKey) return;
  treeIconKey = key;
  document.getElementById('site-icon').href = 'data:image/svg+xml,' + encodeURIComponent(renderTreeIcon(summary));
}
updateTreeIcon();
