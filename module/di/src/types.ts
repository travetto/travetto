import { Class } from '@travetto/runtime';

export type ClassTarget<T = unknown> = Class<T> | Function;

export type PostConstructHandler<T = unknown> = (value: T) => (void | Promise<void>);

export type ResolutionType = 'strict' | 'loose' | 'any';

export type DependencyMap = Record<string | symbol, Dependency>;

/**
 * State of a Dependency
 */
export interface Dependency<T = unknown> {
  /**
   * Whether or not resolution of dependency should be flexible,
   * or should be strict.  Default is strict.
   */
  resolution?: ResolutionType;
  /**
   * Actual reference to a Class
   */
  target?: ClassTarget<T>;
  /**
   * Qualifier symbol
   */
  qualifier?: symbol;
}

/**
 * A parameter dependency
 */
export interface ParameterDependency<T = unknown> extends Dependency<T> {
  /**
   * Index of the parameter (for constructor dependencies)
   */
  index: number;
}

/**
 * Injectable configuration
 */
export interface InjectableCommonConfig<Z extends string, T = unknown> {
  /**
   * Type of injectable
   */
  type: Z;
  /**
   * Reference for the class
   */
  class: Class<T>;
  /**
   * Post construct handlers
   */
  postConstruct: Record<string | symbol, PostConstructHandler>;
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
  /**
   * Actual reference to a Class
   */
  target?: ClassTarget<T>;
  /**
   * Qualifier symbol
   */
  qualifier: symbol;
  /**
   * Parameters for the factory method
   */
  parameters: ParameterDependency[];
}

/**
 * Injectable class configuration, for classes that are able to be injected
 */
export interface InjectableClassConfig<T = unknown> extends InjectableCommonConfig<'class', T> {
  /**
   * Fields that are dependencies
   */
  fields?: DependencyMap;
}

/**
 * Injectable method configuration, for static methods that produce dependencies
 */
export interface InjectableFactoryConfig<T = unknown> extends InjectableCommonConfig<'factory', T> {
  /**
   * Method that is injectable on class
   */
  method: string | symbol;
  /**
   * Method handle
   */
  handle: (...args: unknown[]) => T | Promise<T>;
  /**
   * Return type of the factory method
   */
  returnType: Class;
}

/**
 * Union type for injectable configuration
 */
export type InjectableConfig<T = unknown> = InjectableFactoryConfig<T> | InjectableClassConfig<T>;

/**
 * Full injectable configuration for a class
 */
export interface InjectionClassConfig<T = unknown> {
  /**
   * Reference for the class
   */
  class: Class<T>;
  /**
   * Injectable configuration, if present
   */
  injectable?: InjectableClassConfig<T>;
  /**
   * Factories that are injectable
   */
  factories: Record<string | symbol, InjectableFactoryConfig<T>>;
}

export function getDefaultQualifier(cls: Class, factory?: string | symbol): symbol {
  return factory ? Symbol.for(`${cls.Ⲑid}+factory+${factory?.toString()}`) : Symbol.for(cls.Ⲑid);
}