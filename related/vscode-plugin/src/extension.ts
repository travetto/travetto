import type vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  process.env.TRV_OUTPUT = __dirname.replace(/node_modules.*?$/, '');
  process.env.TRV_MANIFEST = `${process.env.TRV_OUTPUT}/manifest.json`;
  const { setup } = await import('@travetto/boot/support/init.main.js');
  await setup();

  const { ModuleIndex } = await import('@travetto/boot');
  for (const mod of ModuleIndex.findSrc({
    filter: f => /.*\/feature.*?\/main[.]/.test(f)
  })) {
    await import(mod.output);
  }

  const { Workspace } = await import('./core/workspace.js');
  const { ActivationManager } = await import('./core/activation.js');

  Workspace.init(context);
  await ActivationManager.init();
  await ActivationManager.activate(context);
}

export async function deactivate(): Promise<void> {
  const { ActivationManager } = await import('./core/activation.js');
  await ActivationManager.deactivate();
}