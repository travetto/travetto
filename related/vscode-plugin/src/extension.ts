import vscode from 'vscode';

import { RuntimeIndex } from '@travetto/manifest';
import { getManifestContext } from '@travetto/manifest/bin/context';

import { ActivationManager } from './core/activation';
import { Workspace } from './core/workspace';
import { CompilerServer } from './core/compiler';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const [folder] = vscode.workspace.workspaceFolders ?? [];
  if (!folder) {
    return;
  }
  const ctx = await getManifestContext(folder.uri.fsPath);

  await Workspace.init(context, RuntimeIndex, ctx);
  await CompilerServer.init(context);
  await ActivationManager.init();
  await ActivationManager.activate(context);
}

export function deactivate(): Promise<void> {
  return ActivationManager.deactivate();
}