import { CliCommand } from '@travetto/cli';

import { BasePackCommand } from './pack.base';

/**
 * Standard pack support
 */
@CliCommand({ fields: ['module'] })
export class PackCommand extends BasePackCommand { }