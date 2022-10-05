import { EnvInit } from '@travetto/base/support/bin/init';
import { ExecUtil } from '@travetto/boot';

import { ApplicationConfig } from '../src/types';

import { AppListLoader } from './bin/list';

/**
 * Entry point when run directly
 */
export function main(): Promise<ApplicationConfig[]> {
  EnvInit.init();
  return AppListLoader.buildList()
    .then(l => l ?? [])
    .then(ExecUtil.mainResponse, ExecUtil.mainResponse);
}