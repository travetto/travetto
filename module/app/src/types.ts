import type { Class, Closeable } from '@travetto/base';
import { FieldConfig } from '@travetto/schema';

type OrProm<T> = T | Promise<T>;

/** A pattern that can be waited on */
export type Waitable = { wait(): Promise<unknown> } | { on(event: 'close', cb: Function): unknown };

export type AppClass = {
  run(...args: unknown[]): OrProm<Waitable | Closeable | void | undefined>;
};

/**
 * The application's configuration
 */
export interface ApplicationConfig<T extends AppClass = AppClass> {
  name: string; // App name
  filename: string; // Location of file for app
  description?: string;
  start: number; // Start of app
  codeStart: number; // The start of the code
  params?: (Omit<FieldConfig, 'type'> & { type: string })[]; // List of params
  targetId: string; // The class id
  target?: Class<T>; // The actual class of the app
  generatedTime?: number;
}