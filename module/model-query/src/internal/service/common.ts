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
  return !!o && typeof o === 'object' && 'query' in o && !!o.query;
}

/**
 * Type guard for determining if service supports query crud operations
 * @param o
 */
export function isQueryCrudSupported(o: unknown): o is ModelQueryCrudSupport {
  return !!o && typeof o === 'object' && 'deleteByQuery' in o && !!o.deleteByQuery;
}

/**
 * Type guard for determining if service supports query facet operations
 * @param o
 */
export function isQueryFacetSupported(o: unknown): o is ModelQueryFacetSupport {
  return !!o && typeof o === 'object' && 'facet' in o && !!o.facet;
}

/**
 * Type guard for determining if service supports query suggest operations
 * @param o
 */
export function isQuerySuggestSupported(o: unknown): o is ModelQuerySuggestSupport {
  return !!o && typeof o === 'object' && 'suggest' in o && !!o.suggest;
}
