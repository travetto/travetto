import vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  process.chdir(vscode.workspace.workspaceFolders![0].uri.fsPath);

  const { getContext } = await import('@travetto/compiler/bin/transpile.js');
  const ctx = await getContext();

  const out = `${ctx.workspacePath}/${ctx.outputFolder}`;
  process.env.TRV_OUTPUT = out;
  process.env.TRV_MANIFEST = ctx.mainModule;
  process.env.TRV_THROW_ROOT_INDEX_ERR = '1';

  await import('@travetto/manifest');

  const { init } = await import('@travetto/base/support/init.js');
  init();

  const ext = await import('../src/extension.js');
  await ext.activate(context);
}

export async function deactivate(): Promise<void> {
  const ext = await import('../src/extension.js');
  await ext.deactivate();
}