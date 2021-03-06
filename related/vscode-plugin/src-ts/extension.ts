import * as vscode from 'vscode';
// Force directory to match
process.chdir(vscode.workspace.workspaceFolders![0].uri.path);

import { Workspace } from './core/workspace';
import { ActivationManager } from './core/activation';
import './feature';

export async function activate(context: vscode.ExtensionContext) {
  Workspace.init(context);
  await ActivationManager.init();
  await ActivationManager.activate(context);
}

export async function deactivate() {
  await ActivationManager.deactivate();
}