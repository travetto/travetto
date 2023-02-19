import { workerData, parentPort } from 'worker_threads';
import { utimesSync } from 'fs';

const data: { files: string[], interval: number } = workerData;
const files = data.files;

const interval = setInterval(() => {
  const now = Date.now() / 1000;
  for (const file of files) {
    try {
      utimesSync(file, now, now);
    } catch { }
  }
}, data.interval);


parentPort?.on('message', val => {
  if (val === 'stop') {
    files.splice(0, files.length);
    clearInterval(interval);
  } else if (val && typeof val === 'object' && 'files' in val && Array.isArray(val.files)) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    files.splice(0, files.length, ...val.files as string[]);
  }
});