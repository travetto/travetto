// @skip-transformers 
import path from 'path';
import type vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  let root = context.extension.extensionPath;
  try {
    // eslint-disable-next-line no-undef
    root = __dirname.replace(/node_modules.*$/, '');
  } catch { }
  process.env.TRV_MANIFEST = path.resolve(root, 'node_modules', context.extension.packageJSON.name);
  (await import('@travetto/base/support/init.js')).init(false);
  return (await import('../src/extension.js')).activate(context);
}

export async function deactivate(): Promise<void> {
  return (await import('../src/extension.js')).deactivate();
}