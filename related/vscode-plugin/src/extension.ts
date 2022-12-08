import path from 'path';
import vscode from 'vscode';

import { ModuleIndex } from '@travetto/boot';
import { ManifestIndex } from '@travetto/manifest';

import { ActivationManager } from './core/activation';
import { Workspace } from './core/workspace';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (!vscode.workspace.workspaceFolders?.[0]) {
    return;
  }
  const root = path.resolve(__dirname.replace(/\/node_modules.*$/, ''));
  const extManifest = new ManifestIndex(root, `${root}/manifest.json`);

  await Workspace.init(context, extManifest, ModuleIndex);
  await ActivationManager.init();
  await ActivationManager.activate(context);
}

export async function deactivate(): Promise<void> {
  await ActivationManager.deactivate();
}