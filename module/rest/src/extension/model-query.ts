// @file-if @travetto/model-query
import { AppError, Class } from '@travetto/base';
import { ModelType, ModelRegistry } from '@travetto/model';
import { Field, Schema } from '@travetto/schema';
import {
  ModelQueryFacetSupport, ModelQuerySupport, ModelQuerySuggestSupport,
  SortClause, ValidStringFields
} from '@travetto/model-query';
import { isQuerySuggestSupported, isQuerySupported } from '@travetto/model-query/src/internal/service/common';

import { ControllerRegistry } from '../registry/controller';
import { querySchemaParamConfig } from '../internal/param';

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
    const inst = { constructor: target };

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

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(target, getAll),
      {
        description: `Get all ${cls.name}`,
        priority: 101, method: 'get', path: '/', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        responseType: { type: cls, array: true, description: `List of ${cls.name}` }
      }
    );

    // Register field
    ControllerRegistry.registerEndpointParameter(target, getAll, querySchemaParamConfig(), 0);
    Field(RestModelQuery)(inst, 'getAll', 0);

    function suggestField(this: Svc, field: ValidStringFields<T>, suggest: RestModelSuggestQuery) {
      if (isQuerySuggestSupported(this.source)) {
        return this.source.suggest<T>(getCls(), field, suggest.q, suggest);
      } else {
        throw new AppError(`${this.source.constructor.ᚕid} does not support suggesting by query`);
      }
    }

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(target, suggestField),
      {
        description: `Suggest ${cls.name} by specific field`,
        priority: 101, method: 'get', path: '/suggest/:field', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        responseType: { type: cls, description: cls.name }
      }
    );

    // Register fields
    ControllerRegistry.registerEndpointParameter(target, suggestField, { location: 'path', name: 'field' }, 0);
    Field(String, { required: { active: true } })(inst, 'suggestField', 0);

    ControllerRegistry.registerEndpointParameter(target, suggestField, querySchemaParamConfig(), 1);
    Field(RestModelSuggestQuery)(inst, 'suggestField', 1);
  };
}