import { Class } from '@travetto/base';

export type ClassTarget<T = unknown> = Class<T> | Function;

/**
 * State of a Dependency
 */
interface Core<T = unknown> {
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
export interface Dependency<T = unknown> extends Core<T> {
  /**
   * Whether or not the dependency is optional
   */
  optional?: boolean;

  /**
   * Whether or not resolution of dependency should be flexible,
   * or should be strict.  Default is strict.
   */
  resolution?: 'loose' | 'strict';
}

/**
 * Injectable configuration
 */
export interface InjectableConfig<T = unknown> extends Core<T> {
  /**
   * Reference for the class
   */
  class: Class<T>;
  /**
   * Factory function for the injectable
   */
  factory?: (...args: unknown[]) => T;
  /**
   * Is this the primary instance
   */
  primary: boolean;
  /**
   * List of dependencies as fields or as constructor arguments
   */
  dependencies: {
    cons?: Dependency[];
    fields: Record<string, Dependency>;
  };
  /**
   * List of interface types
   */
  interfaces: Class[];
}

/**
 * Factory configuration
 */
export interface InjectableFactoryConfig<T = unknown> extends Core<T> {
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
  dependencies?: Dependency[];
}