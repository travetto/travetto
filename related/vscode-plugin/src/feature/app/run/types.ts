import type { Class } from '@travetto/base';
import type { FieldConfig } from '@travetto/schema';

export type ApplicationParam = (Omit<FieldConfig, 'type' | 'match'> & { type: string, match?: { re: string } });

/**
 * The application's configuration
 */
export interface ApplicationConfig<T = unknown> {
  name: string; // App name
  globalName: string; // Global name, for resolving in monorepos
  module: string;
  import: string; // Import for loading app
  description?: string;
  start: number; // Start of app
  codeStart: number; // The start of the code
  params: ApplicationParam[]; // List of params
  targetId: string; // The class id
  target?: Class<T>; // The actual class of the app
  generatedTime?: number;
}
/**
 * Application choice
 */
export type AppChoice = ApplicationConfig & {
  inputs: string[];
  file: string;
  resolved?: boolean;
  time?: number;
  key?: string;
};

export type ResolvedAppChoice = AppChoice & {
  resolved: true;
  time: number;
  key: string;
};