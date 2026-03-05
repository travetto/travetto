import { CliCommand, CliModuleSupport } from '@travetto/cli';

import { BasePackCommand } from './pack.base';

/**
 * Standard pack support
 */
@CliModuleSupport()
@CliCommand()
export class PackCommand extends BasePackCommand { }