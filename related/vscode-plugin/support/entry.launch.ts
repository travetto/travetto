// @ts-expect-error - Fix vscode navigator problem
try { delete globalThis.navigator; } catch { }

export * from '../src/extension.js';