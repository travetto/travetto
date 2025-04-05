import { WebResponse } from './types/response.ts';
import { WebRequest } from './types/request.ts';

export type FilterContext<C = {}> = { req: WebRequest } & C;
export type WebFilter<C extends FilterContext = FilterContext> = (context: C) => Promise<WebResponse>;
export type WebChainedContext<C = unknown> = FilterContext<{ next: () => Promise<WebResponse>, config: C }>;
export type WebChainedFilter<C = unknown> = WebFilter<WebChainedContext<C>>;