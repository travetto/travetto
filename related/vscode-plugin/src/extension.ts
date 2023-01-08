import path from 'path';
import vscode from 'vscode';

import { RootIndex, ManifestIndex } from '@travetto/manifest';

import { ActivationManager } from './core/activation';
import { Workspace } from './core/workspace';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (!vscode.workspace.workspaceFolders?.[0]) {
    return;
  }
  const extManifest = new ManifestIndex(
    context.extensionPath,
    path.resolve(context.extensionPath, 'node_modules', 'vscode-plugin', 'manifest.json')
  );

  await Workspace.init(context, extManifest, RootIndex);
  await ActivationManager.init();
  await ActivationManager.activate(context);
}

export async function deactivate(): Promise<void> {
  await ActivationManager.deactivate();
}