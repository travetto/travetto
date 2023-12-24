import { parentPort } from 'node:worker_threads';

export function main() {
  parentPort!.postMessage({
    a: 1, b: 2, c: new Set([1, 2, 3])
  });
}