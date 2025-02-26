import { hasFunction } from '@travetto/runtime';

import type { ModelQueryCrudSupport } from '../../service/crud.ts';
import type { ModelQueryFacetSupport } from '../../service/facet.ts';
import type { ModelQuerySupport } from '../../service/query.ts';
import type { ModelQuerySuggestSupport } from '../../service/suggest.ts';

export class ModelQuerySupportTarget { }
export class ModelQueryCrudSupportTarget { }
export class ModelQueryFacetSupportTarget { }
export class ModelQuerySuggestSupportTarget { }

/**
 * Type guard for determining if service supports query operations
 */
export const isQuerySupported = hasFunction<ModelQuerySupport>('query');

/**
 * Type guard for determining if service supports query crud operations
 */
export const isQueryCrudSupported = hasFunction<ModelQueryCrudSupport>('deleteByQuery');

/**
 * Type guard for determining if service supports query facet operations
 */
export const isQueryFacetSupported = hasFunction<ModelQueryFacetSupport>('facet');

/**
 * Type guard for determining if service supports query suggest operations
 */
export const isQuerySuggestSupported = hasFunction<ModelQuerySuggestSupport>('suggest');
