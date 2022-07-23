import { EnvInit } from '@travetto/base/bin/init';
import { ExecUtil } from '@travetto/boot';

import { ApplicationConfig } from '../src/types';

import { AppListUtil } from './lib/list';

/**
 * Entry point when run directly
 */
export function main(): Promise<ApplicationConfig[]> {
  EnvInit.init();
  return AppListUtil.buildList()
    .then(l => l ?? [])
    .then(ExecUtil.mainResponse, ExecUtil.mainResponse);
}