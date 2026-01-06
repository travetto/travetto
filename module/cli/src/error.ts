import { AppError, Runtime } from '@travetto/runtime';
import { PackageUtil } from '@travetto/manifest';

import { cliTpl } from './color.ts';
import type { CliValidationError, CliCommandShape } from './types.ts';

const COMMAND_PACKAGE = [
  [/^test(:watch)?$/, 'test', false],
  [/^lint(:register)?$/, 'eslint', false],
  [/^model:(install|export)$/, 'model', true],
  [/^openapi:(spec|client)$/, 'openapi', true],
  [/^email:(compile|editor)$/, 'email-compiler', false],
  [/^pack(:zip|:docker)?$/, 'pack', false],
  [/^web:http$/, 'web-http', true],
  [/^web:rpc-client$/, 'web-rpc', true],
] as const;

/**
 * Provides a contract for unknown commands
 */
export class CliUnknownCommandError extends Error {

  #getMissingCommandHelp(cmd: string): string | undefined {
    const matchedConfig = COMMAND_PACKAGE.find(([regex]) => regex.test(cmd));
    if (matchedConfig) {
      const [, pkg, prod] = matchedConfig;
      const install = PackageUtil.getInstallCommand(Runtime, `@travetto/${pkg}`, prod);
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
export class CliValidationResultError extends AppError<{ errors: CliValidationError[] }> {
  command: CliCommandShape;

  constructor(command: CliCommandShape, errors: CliValidationError[]) {
    super('', { details: { errors } });
    this.command = command;
  }
}
