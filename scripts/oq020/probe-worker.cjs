// OQ-020 gate, part 2: the code that runs INSIDE the Electron utility
// process — the same kind of process the real segmentation worker will use
// (DOC-03 §1 "workers": separate process, UI never freezes).
'use strict';

const { runProbe } = require('./probe-core.cjs');

const args = process.argv.slice(2);
const runsArg = args.find((a) => a.startsWith('--runs='));
process.parentPort.postMessage({ kind: 'pid', pid: process.pid });
runProbe({
  environment: 'electron-utility-process',
  loadOnly: args.includes('--load-only'),
  runs: runsArg ? Number(runsArg.split('=')[1]) : 3,
})
  .then((report) => {
    process.parentPort.postMessage({ kind: 'report', report });
  })
  .catch((error) => {
    process.parentPort.postMessage({ kind: 'crash', error: String(error) });
  });
