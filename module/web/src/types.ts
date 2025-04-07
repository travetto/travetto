import { WebResponse } from './types/response.ts';
import { WebRequest } from './types/request.ts';

export type WebFilterContext<C = {}> = { req: WebRequest } & C;
export type WebFilter<C extends WebFilterContext = WebFilterContext> = (context: C) => Promise<WebResponse>;
export type WebChainedContext<C = unknown> = WebFilterContext<{ next: () => Promise<WebResponse>, config: C }>;
export type WebChainedFilter<C = unknown> = WebFilter<WebChainedContext<C>>;

/**
 * Defines the shape for a web dispatcher
 *
 * @concrete
 */
export interface WebDispatcher {
  /**
   * Dispatch a request, and return a promise when completed
   */
  dispatch: WebFilter;
}
