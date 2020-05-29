import type { Class } from '@travetto/registry';

type OrProm<T> = T | Promise<T>;

export type AppClass = {
  run(...args: any[]): OrProm<ApplicationHandle | void | undefined>;
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
    [key: string]: any;
  };
  def?: string; // Default value
  optional?: boolean; // Indicates if field is required or not
}

/**
 * The application's configuration
 */
export interface ApplicationConfig<T extends AppClass = AppClass> {
  name: string; // App name
  root: string; // App root location
  filename: string; // Location of file for app
  description?: string;
  params?: ApplicationParameter[]; // List of params
  targetId: string; // The class id
  target?: Class<T>; // The actual class of the app
  generatedTime?: number;
}

/**
 * A pattern that can be used to manage the run state of an application
 */
export interface ApplicationHandle {
  /**
   * Can close an application, if defined
   */
  close?(): void | Promise<void>;
  /**
   * Can wait for an application if defined
   */
  wait?(): Promise<any>;
}