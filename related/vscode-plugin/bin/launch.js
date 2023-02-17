import path from 'path';

/**
 * @param {import('vscode').ExtensionContext} context
 * @returns {Promise<void>}
 */
async function activate(context) {
  let root = context.extension.extensionPath;
  try {
    // eslint-disable-next-line no-undef
    root = __dirname.replace(/node_modules.*$/, '');
  } catch { }
  process.env.TRV_MANIFEST = path.resolve(root, 'node_modules', context.extension.packageJSON.name);
  (await import('@travetto/base/support/init.js')).init(false);
  return (await import('../src/extension.js')).activate(context);
}

/**
 * @returns {Promise<void>}
 */
async function deactivate() {
  return (await import('../src/extension.js')).deactivate();
}

module.exports = { activate, deactivate };