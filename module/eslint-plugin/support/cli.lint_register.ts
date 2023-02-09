import fs from 'fs/promises';

import { CliCommand } from '@travetto/cli';
import { path, RootIndex } from '@travetto/manifest';


export class LintConfigureCommand extends CliCommand {
  name = 'lint:register';

  async action(): Promise<void> {
    const content = [
      `process.env.TRV_MANIFEST = '${RootIndex.mainModule.outputFolder}';`,
      `module.exports = require('${RootIndex.resolveFileImport('@travetto/eslint-plugin/support/eslintrc')}').config;`,
      ''
    ];

    const output = path.resolve(RootIndex.manifest.workspacePath, '.eslintrc.js');
    await fs.writeFile(output, content.join('\n').replaceAll(RootIndex.manifest.workspacePath, '.'));

    console.log(`Wrote eslint config to ${output}`);
  }
}