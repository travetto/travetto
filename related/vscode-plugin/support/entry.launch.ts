// @trv-no-transform
import fs from 'node:fs';
import path from 'node:path';
import vscode from 'vscode';

const extensionPath = vscode.extensions.getExtension('arcsine.travetto-plugin')?.extensionUri.path;

const found = [
  path.resolve(extensionPath ?? '.', 'dist', 'manifest.json'),
  __dirname.replace(/support$/, 'manifest.json'),
].find(file => fs.existsSync(file));

process.env.TRV_MANIFEST = found;

export * from '../src/extension.js';