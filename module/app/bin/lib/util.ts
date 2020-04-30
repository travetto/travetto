import { ApplicationConfig } from '../../src/types';

export interface CachedAppConfig extends ApplicationConfig {
  appRoot: string;
  generatedTime: number;
}

/**
 * Handle app execution failure, with ability to set exit codes
 */
export function handleFailure(err?: Error, exitCode?: number) {
  console.error(err && err.toConsole ? err : (err && err.stack ? err.stack : err));
  if (exitCode) {
    process.exit(exitCode);
  }
}