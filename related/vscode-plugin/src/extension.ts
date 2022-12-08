import { execSync } from 'child_process';
import vscode from 'vscode';

import { path } from '@travetto/manifest';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (!vscode.workspace.workspaceFolders?.[0]) {
    return;
  }
  const { setup } = await import('@travetto/boot/support/init.main.js');
  await setup();

  const { ModuleIndex } = await import('@travetto/boot');
  const extRoot = __dirname.replace(/node_modules\/.*$/, '');
  const extensionManifest = new ModuleIndex(
    extRoot,
    path.resolve(extRoot, 'manifest.json')
  );

  const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  const location = execSync('npx trv manifest', { cwd: root, encoding: 'utf8' }).split(' ').pop()!;
  const workspaceManifest = new ModuleIndex(`${root}/.trv_output`, location);

  const { Workspace } = await import('./core/workspace.js');
  const { ActivationManager } = await import('./core/activation.js');

  await Workspace.init(
    context,
    extensionManifest,
    workspaceManifest
  );
  await ActivationManager.init();
  await ActivationManager.activate(context);
}

export async function deactivate(): Promise<void> {
  const { ActivationManager } = await import('./core/activation.js');
  await ActivationManager.deactivate();
}