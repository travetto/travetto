import { ParamExtractor } from '@travetto/rest';
import { toConcrete } from '@travetto/runtime';

import type { Request, Response } from '../types';

ParamExtractor.registerContext(toConcrete<Request>(), (_, req) => req);
ParamExtractor.registerContext(toConcrete<Response>(), (_, __, res) => res);

export const GlobalRoute = Symbol.for('@travetto/rest:global-route');
