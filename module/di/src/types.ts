import { Class } from '@travetto/runtime';

export type ClassTarget<T = unknown> = Class<T> | Function;

export type PostConstructHandler<T = unknown> = (value: T) => (void | Promise<void>);

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
 * State of a Dependency Target
 */
interface CoreTarget<T = unknown> extends Core<T> {
  /**
   * Is this injectable enabled
   */
  enabled?: boolean | (() => boolean);
  /**
   * Is this the primary instance
   */
  primary?: boolean;
  /**
   * Should the target be auto-created
   */
  autoCreate?: boolean;
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
export interface InjectableConfig<T = unknown> extends CoreTarget<T> {
  /**
   * Reference for the class
   */
  class: Class<T>;
  /**
   * List of dependencies as fields or as constructor arguments
   */
  dependencies: {
    cons?: Dependency[];
    fields: Record<string | symbol, Dependency>;
  };
  /**
   * List of interface types
   */
  interfaces: Class[];
  /**
   * Post construct handlers
   */
  postConstruct: Record<string | symbol, PostConstructHandler>;

  /**
   * Factory function for the injectable
   */
  factory?: (...args: unknown[]) => T;
}