// @file-if @travetto/rest
import { ControllerRegistry, paramConfig } from '@travetto/rest';
import { Schema, schemaParamConfig } from '@travetto/schema';
import { Class } from '@travetto/registry';

import { ModelService } from '../service/model';
import { ModelCore } from '../model/core';
import { ModelRegistry } from '../registry';

type Svc = { source: ModelService };

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

// eslint-disable no-invalid-this
/** @augments trv/di/Injectable */
export function ModelController<T extends ModelCore>(path: string, cls: Class<T>) {
  function getCls() {
    return ModelRegistry.get(cls).class;
  }

  return (target: Class<Svc>) => {

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(target,
        function getAll(this: Svc, full: Query) {
          const where = full.where && full.where.includes('{') ? JSON.parse(full.where) : full.where;

          if (where && typeof where === 'string') {
            return this.source.getAllByQueryString(getCls(), {
              limit: full.limit,
              offset: full.offset,
              sort: full.sort ? JSON.parse(full.sort) : undefined,
              query: where
            });
          } else {
            return this.source.getAllByQuery(getCls(), {
              limit: full.limit,
              offset: full.offset,
              sort: full.sort ? JSON.parse(full.sort) : undefined,
              where
            });
          }
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
        target, function getById(this: Svc, id: string) {
          return this.source.getById(getCls(), id);
        }),
      {
        description: `Get ${cls.name} by id`,
        priority: 102, method: 'get', path: '/:id', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [paramConfig('path', { name: 'id', required: true })],
        responseType: { type: cls, description: cls.name }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function suggestField(this: Svc, field: string, suggest: SuggestQuery) {
          return this.source.suggest(getCls(), field, suggest.q, suggest);
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

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function update(this: Svc, body: any) {
          return this.source.update(getCls(), body);
        }),
      {
        description: `Update ${cls.name}`,
        priority: 103, method: 'put', path: '/',
        params: [schemaParamConfig('body', { type: cls })],
        requestType: { type: cls, description: cls.name },
        responseType: { type: cls, description: cls.name }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function create(this: Svc, body: any) {
          return this.source.save(getCls(), body);
        }),
      {
        description: `Create ${cls.name}`,
        priority: 104, method: 'post', path: '/',
        params: [schemaParamConfig('body', { type: cls })],
        requestType: { type: cls, description: cls.name },
        responseType: { type: cls, description: cls.name }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function remove(this: Svc, id: string) {
          return this.source.deleteById(getCls(), id);
        }),
      {
        params: [paramConfig('path', { name: 'id', required: true })],
        description: `Delete ${cls.name} by id`,
        priority: 105, method: 'delete', path: '/:id'
      });

    ControllerRegistry.register(target, {
      basePath: path,
      class: target,
    });
  };
}