import { AnyMap } from '@travetto/runtime';

/**
 * Represents the general shape of additional login context, usually across multiple calls
 *
 * @concrete ./internal/types#LoginContextTarget
 * @augments `@travetto/rest:Context`
 */
export interface LoginContext extends AnyMap { }