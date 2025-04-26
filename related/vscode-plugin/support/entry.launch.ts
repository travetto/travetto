// @trv-no-transform
import fs from 'node:fs';
import path from 'node:path';
import type vscode from 'vscode';

process.env.TRV_MANIFEST = __dirname.replace(/support$/, 'manifest.json');

export function activate(context: vscode.ExtensionContext): Promise<void> {
  const locs = [
    path.resolve(context.extension.extensionPath, 'dist', 'manifest.json'),
    __dirname.replace(/support$/, 'manifest.json'),
  ];

  // Check packed, then unpacked location of manifest
  let manifest: string | undefined;
  for (const loc of locs) {
    manifest ??= fs.existsSync(loc) ? loc : undefined;
  }

  process.env.TRV_MANIFEST = manifest;
  return import('../src/extension.js').then(v => v.activate(context));
}

export function deactivate(): Promise<void> {
  return import('../src/extension.js').then(v => v.deactivate());
}
