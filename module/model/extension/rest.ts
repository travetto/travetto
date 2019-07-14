import { ControllerRegistry, paramConfig } from '@travetto/rest';
import { schemaParamConfig } from '@travetto/schema/extension/rest';
import { Schema } from '@travetto/schema';

import { Class } from '@travetto/registry';

import { ModelService, ModelCore } from '..';
import { ModelRegistry } from '../src/registry';

type Svc = { source: ModelService };

@Schema()
class Query {
  where?: any;
  sort?: any;
  limit?: number;
  offset?: number;
}

@Schema()
class SuggestQuery {
  q: string;
  limit?: number;
  offset?: number;
}

export function ModelController<T extends ModelCore>(path: string, cls: Class<T>) {
  function getCls() {
    return ModelRegistry.get(cls).class;
  }

  return (target: Class<Svc>) => {

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(target,
        function getAll(this: Svc, full: Query) {
          return this.source.getAllByQuery(getCls(), full);
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
        }), {
        description: `Get ${cls.name} by id`,
        priority: 102, method: 'get', path: '/:id', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [paramConfig('path', 'id')],
        responseType: { type: cls, description: cls.name }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function suggestField(this: Svc, field: string, suggest: SuggestQuery) {
          return this.source.suggestField(getCls(), field, suggest.q, suggest);
        }), {
        description: `Suggest ${cls.name} by specific field`,
        priority: 101, method: 'get', path: '/suggest/:field', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [
          paramConfig('path', 'field'),
          schemaParamConfig('query', { type: SuggestQuery, required: false })
        ],
        responseType: { type: cls, description: cls.name }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function update(this: Svc, body: any) {
          return this.source.update(getCls(), body);
        }), {
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
        }), {
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
        }), {
        params: [paramConfig('path', 'id')],
        description: `Delete ${cls.name} by id`,
        priority: 105, method: 'delete', path: '/:id'
      });

    ControllerRegistry.register(target, {
      basePath: path,
      class: target,
    });
  };
}