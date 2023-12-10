import fs from 'node:fs/promises';
import path from 'node:path';
import type vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Check packed, then unpacked location of manifest
  let manifest: string | undefined;
  for (const loc of [
    async (): Promise<string> => path.resolve(context.extension.extensionPath, 'dist', 'manifest.json'),
    async (): Promise<string> => __dirname.replace(/support$/, 'manifest.json'),
  ]) {
    try {
      const f = await loc();
      await fs.stat(f);
      manifest ??= f;
    } catch { }
  }

  process.env.TRV_MANIFEST = manifest;
  await import('@travetto/base').then(m => m.ConsoleManager.register());
  return (await import('../src/extension.js')).activate(context);
}

export async function deactivate(): Promise<void> {
  return (await import('../src/extension.js')).deactivate();
}