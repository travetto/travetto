import { Env } from '@travetto/base';

import type { ApplicationConfig } from '../src/types';

import { AppListLoader } from './bin/list';

/**
 * Entry point when run directly
 */
export async function main(): Promise<ApplicationConfig[]> {
  Env.define();
  return (await new AppListLoader().getList()) ?? [];
}