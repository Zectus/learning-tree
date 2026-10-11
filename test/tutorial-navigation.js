const stepIndex = app => Number(app.document.getElementById('tutorial-count').textContent.split('/')[0]) - 1;
const stepCount = app => Number(app.document.getElementById('tutorial-count').textContent.split('/')[1]);
async function goToStep(app, target) {
  for (let attempts = 0; stepIndex(app) !== target; attempts++) {
    if (attempts >= stepCount(app)) throw new Error('Tutorial navigation did not reach step ' + target);
    app.document.getElementById(stepIndex(app) < target ? 'tutorial-next' : 'tutorial-back').click();
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
module.exports = { stepIndex, stepCount, goToStep };
