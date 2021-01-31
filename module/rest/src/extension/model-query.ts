// @file-if @travetto/model-query
// @file-if @travetto/schema

import { Class } from '@travetto/base';
import { ModelType, ModelRegistry } from '@travetto/model';
import { Schema } from '@travetto/schema';
import { ModelQueryFacetSupport, ModelQuerySupport, SortClause, ValidStringFields } from '@travetto/model-query';

import { schemaParamConfig } from './schema';
import { ControllerRegistry } from '../registry/controller';
import { paramConfig } from '../decorator/param';

type Svc = { source: ModelQuerySupport & ModelQueryFacetSupport };

@Schema()
class Query {
  where?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

@Schema()
class SuggestQuery {
  q: string;
  limit?: number;
  offset?: number;
}

const convert = <T>(k?: string) => k && typeof k === 'string' && /^[\{\[]/.test(k) ? JSON.parse(k) as T : k;

/**
 * Provides a basic query controller for a given model:
 *
 * - query for all
 * - suggest a field
 */
export function ModelQueryRoutes<T extends ModelType>(cls: Class<T>) {
  function getCls() {
    return ModelRegistry.get(cls).class as Class<T>;
  }

  return (target: Class<Svc>) => {
    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(target,
        function getAll(this: Svc, full: Query) {
          return this.source.query(getCls(), {
            limit: full.limit,
            offset: full.offset,
            sort: convert(full.sort) as SortClause<T>[],
            where: convert(full.where)
          });
        }
      ),
      {
        description: `Get all ${cls.name}`,
        priority: 101, method: 'get', path: '/', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [schemaParamConfig('query', { type: Query, name: 'full', required: false })],
        responseType: { type: cls, array: true, description: `List of ${cls.name}` }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function suggestField(this: Svc, field: ValidStringFields<T>, suggest: SuggestQuery) {
          return this.source.suggest<T>(getCls(), field, suggest.q, suggest);
        }),
      {
        description: `Suggest ${cls.name} by specific field`,
        priority: 101, method: 'get', path: '/suggest/:field', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [
          paramConfig('path', { name: 'field', required: true }),
          schemaParamConfig('query', { type: SuggestQuery, required: false })
        ],
        responseType: { type: cls, description: cls.name }
      }
    );
  };
}