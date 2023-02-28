import path from 'path';
import type vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  let root = context.extension.extensionPath;
  try {
    // eslint-disable-next-line no-undef
    root = __dirname.replace(/node_modules.*$/, ''); // Local development
  } catch { }
  process.env.TRV_MANIFEST = path.resolve(root, 'node_modules', context.extension.packageJSON.name);
  const { init } = await import('@travetto/base/support/init.js');
  await init(false);
  return (await import('../src/extension.js')).activate(context);
}

export async function deactivate(): Promise<void> {
  return (await import('../src/extension.js')).deactivate().finally(() =>
    // Denote intent to exit
    process.emit('SIGUSR2')
  );
}