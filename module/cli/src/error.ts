import { RootIndex } from '@travetto/manifest';

import { cliTpl } from './color';
import { CliValidationError } from './types';

const COMMAND_PACKAGE = [
  [/^test(:watch)?$/, 'test', false],
  [/^service$/, 'command', true],
  [/^lint(:register)?$/, 'lint', true],
  [/^model:(install|export)$/, 'model', true],
  [/^openapi:(spec|client)$/, 'openapi', true],
  [/^email:(compile|editor)$/, 'email-compiler', false],
  [/^pack(:zip|:docker)?$/, 'pack', false],
  [/^run(:rest)?$/, 'rest', false],
] as const;

/**
 * Provides a contract for unknown commands
 */
export class CliUnknownCommandError extends Error {

  #getMissingCommandHelp(cmd: string): string | undefined {
    const matchedCfg = COMMAND_PACKAGE.find(([re]) => re.test(cmd));
    if (matchedCfg) {
      const [, pkg, prod] = matchedCfg;
      let install: string;
      switch (RootIndex.manifest.packageManager) {
        case 'npm': install = `npm i ${prod ? '' : '--save-dev '}@travetto/${pkg}`; break;
        case 'yarn': install = `yarn add ${prod ? '' : '--dev '}@travetto/${pkg}`; break;
      }
      return cliTpl`
${{ title: 'Missing Package' }}\n${'-'.repeat(20)}\nTo use ${{ input: cmd }} please run:\n
${{ identifier: install }}
`;
    }
  }

  help?: string;
  cmd: string;

  constructor(cmd: string) {
    super(`Unknown command: ${cmd}`);
    this.cmd = cmd;
    this.help = this.#getMissingCommandHelp(cmd);
  }

  get defaultMessage(): string {
    return cliTpl`${{ subtitle: 'Unknown command' }}: ${{ input: this.cmd }}`;
  }
}


/**
 * Provides a basic error wrapper for cli validation issues
 */
export class CliValidationResultError extends Error {
  errors: CliValidationError[];

  constructor(errors: CliValidationError[]) {
    super('');
    this.errors = errors;
  }
}
