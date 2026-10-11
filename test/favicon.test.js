const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp} = require('./harness');
const icon = app => app.document.getElementById('site-icon').getAttribute('href');
const svg = app => new app.window.DOMParser().parseFromString(decodeURIComponent(icon(app).split(',')[1]),'image/svg+xml');

test('tab icon uses symbolic sizes and completion of required topics only',()=>{
  const app=loadApp();
  try {
    for (const [total,done,expected] of [[0,0,[3,0]],[1,0,[3,0]],[5,2,[3,1]],[6,3,[5,2]],[20,19,[5,4]],[21,10,[7,3]],[21,21,[7,7]]]) {
      app.window.__nodes=Array.from({length:total},(_,i)=>({done:i<done}));
      app.ev('state.nodes=new Map(__nodes.map((n,i)=>[i,n])); updateProgress();');
      assert.equal(svg(app).querySelectorAll('.topic').length,expected[0]);
      assert.equal(svg(app).querySelectorAll('.topic.complete').length,expected[1]);
      const before=icon(app);
      app.ev('state.nodes.set(999,{optional:true,done:true});state.nodes.set(998,{optional:true,done:false});updateProgress();');
      assert.equal(icon(app),before);
    }
  } finally {app.window.close();}
});

test('icon follows optional toggles, progress changes, tree switching, and clearing',()=>{
  const app=loadApp();
  try {
    app.window.__tree=app.fixture('mini-tree.json');
    app.ev('loadFromJSON(JSON.parse(__tree)); state.nodes.forEach(n=>n.done=true);updateAllStatuses();');
    assert.equal(svg(app).querySelectorAll('.topic.complete').length,3);
    app.ev('state.nodes.get(1).done=false;updateAllStatuses();');
    assert.equal(svg(app).querySelectorAll('.topic.complete').length,2);
    app.ev("setMode('edit'); state.nodes.get(1).el.querySelectorAll('.btn')[1].click();");
    assert.equal(app.ev('state.nodes.get(1).optional'),true);
    assert.equal(svg(app).querySelectorAll('.topic.complete').length,3);
    app.ev("state.nodes.get(1).el.querySelectorAll('.btn')[1].click();");
    assert.equal(svg(app).querySelectorAll('.topic.complete').length,2);
    app.ev('loadFromJSON({nodes:[{id:"fresh",label:"New"}]});');
    assert.equal(svg(app).querySelectorAll('.topic.complete').length,0);
    app.ev('state.nodes.get(1).done=true;updateAllStatuses();clearMap();');
    assert.equal(svg(app).querySelectorAll('.topic.complete').length,0);
    assert.equal(svg(app).querySelector('parsererror'),null);
  } finally {app.window.close();}
});
