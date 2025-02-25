// @trv-no-transform
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
      manifest ??= await loc().then(f => fs.stat(f).then(() => f));
    } catch { }
  }

  process.env.TRV_MANIFEST = manifest;
  return (await import('../src/extension')).activate(context);
}

export async function deactivate(): Promise<void> {
  return (await import('../src/extension')).deactivate();
}