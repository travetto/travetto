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
 * @param o
 */
export function isQuerySupported(o: unknown): o is ModelQuerySupport {
  return !!o && !!(o as Record<string, unknown>)['query'];
}

/**
 * Type guard for determining if service supports query crud operations
 * @param o
 */
export function isQueryCrudSupported(o: unknown): o is ModelQueryCrudSupport {
  return !!o && !!(o as Record<string, unknown>)['deleteByQuery'];
}

/**
 * Type guard for determining if service supports query facet operations
 * @param o
 */
export function isQueryFacetSupported(o: unknown): o is ModelQueryFacetSupport {
  return !!o && !!(o as Record<string, unknown>)['facet'];
}

/**
 * Type guard for determining if service supports query suggest operations
 * @param o
 */
export function isQuerySuggestSupported(o: unknown): o is ModelQuerySuggestSupport {
  return !!o && !!(o as Record<string, unknown>)['suggest'];
}
