import { CliCommand } from '@travetto/cli';

import { BasePackCommand } from './pack.base';

/**
 * Standard pack support
 */
@CliCommand()
export class PackCommand extends BasePackCommand { }