try {
  // @ts-expect-error - Fix vscode navigator problem
  delete globalThis.navigator;
} catch {}

export * from '../src/extension.js';
