import vscode from 'vscode';

/**
 * @param {vscode.ExtensionContext} context
 * @returns {Promise<void>}
 */
async function activate(context) {
  const { getManifestContext } = await import('@travetto/manifest/bin/context.js');
  const ctx = await getManifestContext(
    vscode.workspace.workspaceFolders[0].uri.fsPath
  );

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

/**
 * @returns {Promise<void>}
 */
async function deactivate() {
  const ext = await import('../src/extension.js');
  await ext.deactivate();
}

module.exports = { activate, deactivate };