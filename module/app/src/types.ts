import type { Class, Closeable } from '@travetto/base';

type OrProm<T> = T | Promise<T>;

/** A pattern that can be waited on */
export type Waitable = { wait(): Promise<unknown> } | { on(event: 'close', cb: Function): unknown };
export type AppClass = {
  run(...args: unknown[]): OrProm<Waitable | Closeable | void | undefined>;
};

/**
 * An individual parameter of an application config
 */
export interface ApplicationParameter {
  name: string;
  title?: string;
  type?: string; // string, number, boolean
  subtype?: string; // For string, something like date or choice
  meta?: {
    choices: string[]; // Applies if subtype is choice
    [key: string]: unknown;
  };
  def?: string; // Default value
  optional?: boolean; // Indicates if field is required or not
}

/**
 * The application's configuration
 */
export interface ApplicationConfig<T extends AppClass = AppClass> {
  name: string; // App name
  filename: string; // Location of file for app
  description?: string;
  start: number; // Start of app
  codeStart: number; // The start of the code
  params?: ApplicationParameter[]; // List of params
  targetId: string; // The class id
  target?: Class<T>; // The actual class of the app
  generatedTime?: number;
  watch?: boolean; // Should the application be watched by default
}

