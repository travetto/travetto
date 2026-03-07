import { CliCommand, CliModuleSupport } from '@travetto/cli';

import { BasePackCommand } from './pack.base';

/**
 * Standard pack support
 */
@CliCommand()
export class PackCommand extends BasePackCommand { }