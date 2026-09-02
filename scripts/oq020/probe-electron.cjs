// OQ-020 gate, part 2: Electron main process that forks the probe into a
// utility process (the process type the real segmentation worker will use)
// and prints its report.
// Usage: npx electron scripts/oq020/probe-electron.cjs
'use strict';

const { app, utilityProcess } = require('electron');
const path = require('node:path');

app.whenReady().then(() => {
  const child = utilityProcess.fork(path.join(__dirname, 'probe-worker.cjs'), process.argv.slice(2), {
    serviceName: 'oq020-probe',
    stdio: 'inherit',
  });
  const timeout = setTimeout(() => {
    console.error('Probe timed out after 120 s.');
    child.kill();
    app.exit(1);
  }, 120_000);

  child.on('message', (message) => {
    if (message.kind === 'pid') {
      console.log(`WORKER_PID ${message.pid}`);
      return;
    }
    clearTimeout(timeout);
    if (message.kind === 'report') {
      console.log(JSON.stringify(message.report, null, 2));
      app.exit(message.report.pass ? 0 : 1);
    } else {
      console.error('Worker crashed:', message.error);
      app.exit(1);
    }
  });
  child.on('exit', (code) => {
    if (code !== 0) {
      clearTimeout(timeout);
      console.error(`Worker exited unexpectedly with code ${code}.`);
      app.exit(1);
    }
  });
});
