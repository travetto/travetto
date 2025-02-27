import { ParamExtractor } from '@travetto/rest';
import { asConcrete } from '@travetto/runtime';

import type { Request, Response } from '../types';

ParamExtractor.registerContext(asConcrete<Request>(), (_, req) => req);
ParamExtractor.registerContext(asConcrete<Response>(), (_, __, res) => res);

export const GlobalRoute = Symbol.for('@travetto/rest:global-route');
