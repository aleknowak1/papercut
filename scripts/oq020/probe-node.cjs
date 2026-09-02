// OQ-020 gate, part 1: run the probe in plain Node.
// Usage: node scripts/oq020/probe-node.cjs
'use strict';

const { runProbe } = require('./probe-core.cjs');

const args = process.argv.slice(2);
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : undefined;
};
console.log(`PROBE_PID ${process.pid}`);
runProbe({
  environment: 'plain-node',
  loadOnly: args.includes('--load-only'),
  runs: opt('runs') ? Number(opt('runs')) : 3,
  model: opt('model'),
  ep: opt('ep'),
  saveDir: opt('save'),
})
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.pass ? 0 : 1);
  })
  .catch((error) => {
    console.error('Probe crashed:', error);
    process.exit(1);
  });
