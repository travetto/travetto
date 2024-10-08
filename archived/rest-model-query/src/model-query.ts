import { AppError, castTo, Class } from '@travetto/runtime';
import { ModelType, ModelRegistry } from '@travetto/model';
import { Field, Schema } from '@travetto/schema';
import { ControllerRegistry } from '@travetto/rest';
import { ModelQueryFacetSupport, ModelQuerySupport, ModelQuerySuggestSupport, ValidStringFields, PageableModelQuery } from '@travetto/model-query';
import { isQuerySuggestSupported, isQuerySupported } from '@travetto/model-query/src/internal/service/common';
import { QueryLanguageParser } from '@travetto/model-query-language';


type Svc = { source: Partial<ModelQuerySupport & ModelQuerySuggestSupport & ModelQueryFacetSupport> };

const convert = <T>(k?: string, query?: boolean): T | undefined =>
  !k || typeof k !== 'string' ? undefined : (/^[\{\[]/.test(k) ? JSON.parse(k) : (query ? QueryLanguageParser.parseToQuery(k) : undefined));


@Schema()
export class RestModelQuery {
  where?: string;
  sort?: string;
  limit?: number;
  offset?: number;

  finalize<T>(): PageableModelQuery<T> {
    return {
      ...(this.limit ? { limit: this.limit } : {}),
      ...(this.offset ? { offset: this.offset } : {}),
      ...(this.sort ? { sort: convert(this.sort) } : {}),
      ...(this.where ? { where: convert(this.where, true) } : {}),
    };
  }
}

@Schema()
export class RestModelSuggestQuery {
  q: string;
  limit?: number;
  offset?: number;
}

/**
 * Provides a basic query controller for a given model:
 *
 * - query for all
 * - suggest a field
 */
export function ModelQueryRoutes<T extends ModelType>(cls: Class<T>): (target: Class<Svc>) => void {
  function getCls(): Class<T> {
    return castTo(ModelRegistry.get(cls).class);
  }

  return (target: Class<Svc>) => {
    const inst = { constructor: target };

    function getAll(this: Svc, full: RestModelQuery): Promise<T[]> {
      if (isQuerySupported(this.source)) {
        return this.source.query(getCls(), full.finalize());
      } else {
        throw new AppError(`${this.source.constructor.Ⲑid} does not support querying`);
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
    ControllerRegistry.registerEndpointParameter(target, getAll, { location: 'query', name: 'search' }, 0);
    Field(RestModelQuery)(inst, 'getAll', 0);

    function suggestField(this: Svc, field: ValidStringFields<T>, suggest: RestModelSuggestQuery): Promise<T[]> {
      if (isQuerySuggestSupported(this.source)) {
        return this.source.suggest<T>(getCls(), field, suggest.q, suggest);
      } else {
        throw new AppError(`${this.source.constructor.Ⲑid} does not support suggesting by query`);
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

    ControllerRegistry.registerEndpointParameter(target, suggestField, { location: 'query', name: 'search' }, 1);
    Field(RestModelSuggestQuery)(inst, 'suggestField', 1);
  };
}