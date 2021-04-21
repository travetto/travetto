// @file-if @travetto/model-query
// @file-if @travetto/schema

import { AppError, Class } from '@travetto/base';
import { ModelType, ModelRegistry } from '@travetto/model';
import { Schema } from '@travetto/schema';
import {
  ModelQueryFacetSupport, ModelQuerySupport, ModelQuerySuggestSupport,
  SortClause, ValidStringFields
} from '@travetto/model-query';
import { isQuerySuggestSupported, isQuerySupported } from '@travetto/model-query/src/internal/service/common';

import { schemaParamConfig } from './schema';
import { ControllerRegistry } from '../registry/controller';
import { paramConfig } from '../decorator/param';

type Svc = { source: Partial<ModelQuerySupport & ModelQuerySuggestSupport & ModelQueryFacetSupport> };

@Schema()
export class RestModelQuery {
  where?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

@Schema()
export class RestModelSuggestQuery {
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
        function getAll(this: Svc, full: RestModelQuery) {
          if (isQuerySupported(this.source)) {
            return this.source.query(getCls(), {
              limit: full.limit,
              offset: full.offset,
              sort: convert(full.sort) as SortClause<T>[],
              where: convert(full.where)
            });
          } else {
            throw new AppError(`${this.source.constructor.ᚕid} does not support querying`);
          }
        }
      ),
      {
        description: `Get all ${cls.name}`,
        priority: 101, method: 'get', path: '/', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [schemaParamConfig('query', { type: RestModelQuery, name: 'full', required: false })],
        responseType: { type: cls, array: true, description: `List of ${cls.name}` }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function suggestField(this: Svc, field: ValidStringFields<T>, suggest: RestModelSuggestQuery) {
          if (isQuerySuggestSupported(this.source)) {
            return this.source.suggest<T>(getCls(), field, suggest.q, suggest);
          } else {
            throw new AppError(`${this.source.constructor.ᚕid} does not support suggesting by query`);
          }
        }),
      {
        description: `Suggest ${cls.name} by specific field`,
        priority: 101, method: 'get', path: '/suggest/:field', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [
          paramConfig('path', { name: 'field', required: true }),
          schemaParamConfig('query', { type: RestModelSuggestQuery, required: false })
        ],
        responseType: { type: cls, description: cls.name }
      }
    );
  };
}