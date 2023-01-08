/**
 * @param {import('vscode').ExtensionContext} context
 */
async function activate(context) {
  const vscode = await import('vscode');
  process.chdir(vscode.workspace.workspaceFolders[0].uri.fsPath);

  const { getContext } = await import('@travetto/compiler/bin/transpile');
  const ctx = await getContext();

  const out = `${ctx.workspacePath}/${ctx.outputFolder}`;
  process.env.TRV_OUTPUT = out;
  process.env.TRV_MANIFEST = ctx.mainModule;
  process.env.TRV_THROW_ROOT_INDEX_ERR = '1';

  await import('@travetto/manifest');

  const { setup } = await import('@travetto/base/support/init.main');
  setup();

  const ext = await import('../src/extension.js');
  await ext.activate(context);
}

async function deactivate() {
  const ext = await import('../src/extension.js');
  await ext.deactivate();
}

module.exports = { activate, deactivate };