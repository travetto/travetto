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
  return !!o && 'query' in (o as object);
}

/**
 * Type guard for determining if service supports query crud operations
 * @param o
 */
export function isQueryCrudSupported(o: unknown): o is ModelQueryCrudSupport {
  return !!o && 'deleteByQuery' in (o as object);
}

/**
 * Type guard for determining if service supports query facet operations
 * @param o
 */
export function isQueryFacetSupported(o: unknown): o is ModelQueryFacetSupport {
  return !!o && 'facet' in (o as object);
}

/**
 * Type guard for determining if service supports query suggest operations
 * @param o
 */
export function isQuerySuggestSupported(o: unknown): o is ModelQuerySuggestSupport {
  return !!o && 'suggest' in (o as object);
}
