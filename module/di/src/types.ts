import { Class } from '@travetto/registry';

export type ClassTarget<T> = Class<T> | Function;

/**
 * State of a Dependency
 */
interface Core<T = any> {
  /**
   * Actual reference to a Class
   */
  target: ClassTarget<T>;
  /**
   * Qualifier symbol
   */
  qualifier: symbol;
}


/**
 * State of a Dependency
 */
export interface Dependency<T = any> extends Core<T> {
  /**
   * Whether or not the dependency is optional
   */
  optional?: boolean;
}

/**
 * Injectable configuration
 */
export interface InjectableConfig<T = any> extends Core<T> {
  /**
   * Reference for the class
   */
  class: Class<T>;
  /**
   * Factory function for the injectable
   */
  factory?: (...args: any[]) => T;
  /**
   * Is this the primary instance
   */
  primary: boolean;
  /**
   * List of dependencies as fields or as constructor arguments
   */
  dependencies: {
    cons?: Dependency<any>[];
    fields: Record<string, Dependency<any>>;
  };
  /**
   * List of interface types
   */
  interfaces: Class[];
}

/**
 * Factory configuration
 */
export interface InjectableFactoryConfig<T> extends Core<T> {
  /**
   * Src of the factory method
   */
  src: Class<T>;
  /**
   * Is this the primary instance
   */
  primary?: boolean;
  /**
   * List of all dependencies as function arguments
   */
  dependencies?: Dependency<any>[];
}