import path from 'path';
import vscode from 'vscode';

import { ManifestIndex } from '@travetto/manifest';
import { getManifestContext } from '@travetto/manifest/bin/context';

import { ActivationManager } from './core/activation';
import { Workspace } from './core/workspace';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const [folder] = vscode.workspace.workspaceFolders ?? [];
  if (!folder) {
    return;
  }
  const { name } = context.extension.packageJSON;
  const extManifest = new ManifestIndex(path.resolve(context.extensionPath, 'node_modules', name));
  const ctx = await getManifestContext(folder.uri.fsPath);

  await Workspace.init(context, extManifest, ctx);
  await ActivationManager.init();
  await ActivationManager.activate(context);
}

export function deactivate(): Promise<void> {
  return ActivationManager.deactivate();
}