// OQ-020 gate, part 2: the code that runs INSIDE the Electron utility
// process — the same kind of process the real segmentation worker will use
// (DOC-03 §1 "workers": separate process, UI never freezes).
'use strict';

const { runProbe } = require('./probe-core.cjs');

const args = process.argv.slice(2);
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : undefined;
};
process.parentPort.postMessage({ kind: 'pid', pid: process.pid });
runProbe({
  environment: 'electron-utility-process',
  loadOnly: args.includes('--load-only'),
  runs: opt('runs') ? Number(opt('runs')) : 3,
  model: opt('model'),
  ep: opt('ep'),
  saveDir: opt('save'),
})
  .then((report) => {
    process.parentPort.postMessage({ kind: 'report', report });
  })
  .catch((error) => {
    process.parentPort.postMessage({ kind: 'crash', error: String(error) });
  });
