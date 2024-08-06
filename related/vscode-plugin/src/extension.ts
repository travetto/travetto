import vscode from 'vscode';

import { Runtime, RuntimeIndex } from '@travetto/runtime';
import { getManifestContext } from '@travetto/manifest/bin/context';

import { ActivationManager } from './core/activation';
import { Workspace } from './core/workspace';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const [folder] = vscode.workspace.workspaceFolders ?? [];
  if (!folder) {
    return;
  }

  const ctx = await getManifestContext(folder.uri.fsPath);
  await Workspace.init(context, ctx, folder);

  for (const ext of RuntimeIndex.find({ file: f => /.*\/feature.*?\/main[.]/.test(f.sourceFile) })) {
    await Runtime.importFrom(ext.import);
  }

  await ActivationManager.init();
  await ActivationManager.activate(context);
}

export function deactivate(): Promise<void> {
  return ActivationManager.deactivate();
}