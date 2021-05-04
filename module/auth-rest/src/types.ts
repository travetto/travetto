/**
 * Represents the general shape of additional login context, usually across multiple calls
 *
 * @concrete ./internal/types:LoginContextTarget
 * @augments `@trv:rest/Context`
 */
export interface LoginContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}