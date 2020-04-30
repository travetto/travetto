import { ApplicationConfig } from '../../src/types';

export interface CachedAppConfig extends ApplicationConfig {
  appRoot: string;
  generatedTime: number;
}

export function handleFailure(err?: Error, exitCode?: number) {
  console.error(err && err.toConsole ? err : (err && err.stack ? err.stack : err));
  if (exitCode) {
    process.exit(exitCode);
  }
}