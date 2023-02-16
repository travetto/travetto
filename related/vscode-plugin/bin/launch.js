import path from 'path';

/**
 * @param {vscode.ExtensionContext} context
 * @returns {Promise<void>}
 */
async function activate(context) {
  process.env.TRV_MANIFEST = path.resolve(__dirname, '..');
  (await import('@travetto/base/support/init.js')).init();
  return (await import('../src/extension.js')).activate(context);
}

/**
 * @returns {Promise<void>}
 */
async function deactivate() {
  return (await import('../src/extension.js')).deactivate();
}

module.exports = { activate, deactivate };