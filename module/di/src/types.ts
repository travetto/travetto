import { Class } from '@travetto/runtime';

export type ClassTarget<T = unknown> = Class<T> | Function;

export type PostConstructHandler<T = unknown> = (value: T) => (void | Promise<void>);

export const DiSchemaSymbol = Symbol();

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
 * Injectable candidate
 */
export interface InjectableCandidateConfig<T = unknown> {
  /**
   * Method that is injectable on class
   */
  method: string | symbol;
  /**
   * Method handle
   */
  factory: (...args: unknown[]) => T | Promise<T>;
  /**
   * Return type of the factory method
   */
  candidateType: Class;
  /**
   * Reference for the class
   */
  class: Class<T>;
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
}

/**
 * Full injectable configuration for a class
 */
export interface InjectableConfig<T = unknown> {
  /**
   * Reference for the class
   */
  class: Class<T>;
  /**
   * Candidates that are injectable
   */
  candidates: Record<string | symbol, InjectableCandidateConfig<T>>;
}

export function getDefaultQualifier(cls: Class, factory?: string | symbol): symbol {
  return factory ? Symbol.for(`${cls.Ⲑid}+factory+${factory?.toString()}`) : Symbol.for(cls.Ⲑid);
}