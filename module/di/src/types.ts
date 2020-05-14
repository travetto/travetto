import { Class } from '@travetto/registry';

export type ClassTarget<T> = Class<T> | Function;

/**
 * State of a Dependency
 */
export interface Dependency<T = any> {
  /**
   * Actual reference to a Class
   */
  target: ClassTarget<T>;
  /**
   * Qualifier symbol
   */
  qualifier: symbol;
  /**
   * Whether or not the dependency is optional
   */
  optional?: boolean;
  /**
   * Default if missing
   */
  defaultIfMissing?: ClassTarget<T>;
  /**
   * The original qualifier
   */
  original?: symbol | object;
}

/**
 * Injectable configuration
 */
export interface InjectableConfig<T = any> extends Dependency<T> {
  /**
   * Reference for the class
   */
  class: Class<T>;
  /**
   * Factory function for the injectable
   */
  factory?: (...args: any[]) => T;
  /**
   * List of dependencies as fields or as constructor arguments
   */
  dependencies: {
    cons?: Dependency<any>[];
    fields: Record<string, Dependency<any>>;
  };
}

/**
 * Factory configuration
 */
export interface InjectableFactoryConfig<T> {
  /**
   * Reference for target class
   */
  target: Class<T>;
  /**
   * Src of the factory method
   */
  src: Class<T>;
  /**
   * Qualifier for the dependency
   */
  qualifier?: symbol;
  /**
   * List of all dependencies as function arguments
   */
  dependencies?: Dependency<any>[];
  /**
   * Original symbol
   */
  original?: symbol | object;
}