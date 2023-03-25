import fs from 'fs/promises';
import path from 'path';
import type vscode from 'vscode';

let cleanup: Function | undefined = undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Check packed, then unpacked location of manifest
  let manifest: string | undefined;
  for (const loc of [
    async () => path.resolve(context.extension.extensionPath, 'dist', 'manifest.json'),
    async () => __dirname.replace(/support$/, 'manifest.json'),
  ]) {
    try {
      const f = await loc();
      await fs.stat(f);
      manifest ??= f;
    } catch { }
  }

  process.env.TRV_MANIFEST = manifest;
  const { init, cleanup: clean } = await import('@travetto/base/support/init.js');
  await init(false);
  cleanup = clean;
  return (await import('../src/extension.js')).activate(context);
}

export async function deactivate(): Promise<void> {
  return (await import('../src/extension.js')).deactivate().finally(() => cleanup?.());
}