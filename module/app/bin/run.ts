import { AppRunUtil } from './lib/run';

/**
 * Direct invocation of applications
 */
export function main(app: string, ...args: string[]): Promise<void> {
  return AppRunUtil.run(app, ...args);
}