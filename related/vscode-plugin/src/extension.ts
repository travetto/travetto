import vscode from 'vscode';

import { RootIndex } from '@travetto/manifest';
import { getManifestContext } from '@travetto/manifest/bin/context';

import { ActivationManager } from './core/activation';
import { Workspace } from './core/workspace';
import { BuildStatus } from './core/build';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const [folder] = vscode.workspace.workspaceFolders ?? [];
  if (!folder) {
    return;
  }
  const ctx = await getManifestContext(folder.uri.fsPath);

  await Workspace.init(context, RootIndex, ctx);
  await BuildStatus.init(context);
  await ActivationManager.init();
  await ActivationManager.activate(context);
  BuildStatus.listenForChanges();
}

export function deactivate(): Promise<void> {
  return ActivationManager.deactivate();
}