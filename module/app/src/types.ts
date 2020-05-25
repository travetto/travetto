import { Class } from '@travetto/registry';

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
export interface ApplicationConfig<T = any> {
  name: string; // App name
  filename: string; // Location of file for app
  description?: string;
  params?: ApplicationParameter[]; // List of params
  target: Class<T>; // The actual class of the app
  watchable?: boolean; // Whether or not the app runs in watch mode by default
}

/**
 * App config that has been cached
 */
export interface CachedAppConfig extends ApplicationConfig {
  appRoot: string;
  generatedTime: number;
}

/**
 * A pattern that can be used to manage the run state of an application
 */
export interface ApplicationHandle {
  /**
   * Can close an application, if defined
   */
  close?(): Promise<any>;
  /**
   * Can wait for an application if defined
   */
  wait?(): Promise<any>;
}