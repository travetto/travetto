import path from 'path';

/**
 * @param {vscode.ExtensionContext} context
 * @returns {Promise<void>}
 */
async function activate(context) {
  const vscode = await import('vscode');
  const { getManifestContext } = await import('@travetto/manifest/bin/context.js');

  const ctx = await getManifestContext(
    vscode.workspace.workspaceFolders[0].uri.fsPath
  );

  process.env.TRV_MANIFEST = path.resolve(ctx.workspacePath, ctx.outputFolder, 'node_modules', ctx.mainModule);
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