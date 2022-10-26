import { EnvInit } from '@travetto/base/support/bin/env';

import { ApplicationConfig } from '../src/types';

import { AppListLoader } from './bin/list';

/**
 * Entry point when run directly
 */
export async function main(): Promise<ApplicationConfig[]> {
  EnvInit.init();
  return (await AppListLoader.buildList()) ?? [];
}