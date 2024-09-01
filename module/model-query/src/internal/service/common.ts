import { hasFunction } from '@travetto/runtime';
import type { ModelQueryCrudSupport } from '../../service/crud';
import type { ModelQueryFacetSupport } from '../../service/facet';
import type { ModelQuerySupport } from '../../service/query';
import type { ModelQuerySuggestSupport } from '../../service/suggest';

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
