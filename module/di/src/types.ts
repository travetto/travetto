import { Class } from '@travetto/runtime';

export type ResolutionType = 'strict' | 'loose' | 'any';

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
  target?: Class<T>;
  /**
   * Qualifier symbol
   */
  qualifier?: symbol;
}

/**
 * Injectable candidate
 */
export interface InjectableCandidate<T = unknown> {
  /**
   * Reference for the class
   */
  class: Class<T>;
  /**
   * Method that is injectable on class
   */
  method: string | symbol;
  /**
   * Method handle
   */
  factory: (...args: unknown[]) => T | Promise<T>;
  /**
   * The type of the candidate
   */
  candidateType: Class;
  /**
   * Is this injectable enabled
   */
  enabled?: boolean | (() => boolean);
  /**
   * Is this the primary instance
   */
  primary?: boolean;
  /**
   * Should the target be constructed on startup
   */
  autoInject?: boolean;
  /**
   * Actual reference to a Class
   */
  target?: Class;
  /**
   * Qualifier symbol
   */
  qualifier?: symbol;
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
  candidates: Record<string | symbol, InjectableCandidate>;
}

export function getDefaultQualifier(cls: Class): symbol {
  return Symbol.for(cls.Ⲑid);
}


export const PrimaryCandidateSymbol = Symbol();

export type InjectableClassMetadata = {
  postConstruct: Record<string | symbol, (<T>(inst: T) => Promise<void>)>;
};