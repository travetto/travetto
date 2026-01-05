import * as vscode from 'vscode';

import { Runtime, RuntimeIndex } from '@travetto/runtime';
import { getManifestContext } from '@travetto/manifest';

import { ActivationManager } from './core/activation.ts';
import { Workspace } from './core/workspace.ts';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const [folder] = vscode.workspace.workspaceFolders ?? [];
  if (!folder) {
    return;
  }

  const ctx = await getManifestContext(folder.uri.fsPath);
  console.log('Initializing travetto plugin at', folder.uri.fsPath, ctx.workspace.path);
  await Workspace.init(context, ctx, folder);

  for (const ext of RuntimeIndex.find({ file: file => /.*\/feature.*?\/main[.]/.test(file.sourceFile) })) {
    await Runtime.importFrom(ext.import);
  }

  await ActivationManager.init();
  await ActivationManager.activate(context);
}

export function deactivate(): Promise<void> {
  return ActivationManager.deactivate();
}