import { ControllerRegistry, Request, extractRequest } from '@travetto/rest';
import { getSchemaInstance } from '@travetto/schema/extension/rest';
import { Class } from '@travetto/registry';

import { ModelService, ModelCore } from '..';
import { ModelRegistry } from '../src/registry';

type Svc = { source: ModelService };

export function ModelController<T extends ModelCore>(path: string, cls: Class<T>) {
  function getCls() {
    return ModelRegistry.get(cls).class;
  }

  return (target: Class<Svc>) => {

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function getAll(this: Svc, req: Request) {
          return this.source.getAllByQuery(getCls(), JSON.parse(req.query.q || '{}'));
        }), {
        description: `Get all ${cls.name}`,
        priority: 101, method: 'get', path: '/', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [{ extract: extractRequest }],
        responseType: { description: `List of ${cls.name}`, type: cls, array: true }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function getById(this: Svc, req: Request) {
          return this.source.getById(getCls(), req.params.id);
        }), {
        description: `Get ${cls.name} by id`,
        priority: 102, method: 'get', path: '/:id', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [
          { extract: extractRequest },
          { type: String, name: 'id', location: 'path', extract: () => { } }
        ],
        responseType: { description: cls.name, type: cls }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function suggestField(this: Svc, req: Request) {
          return this.source.suggestField(getCls(), req.params.field, req.query.q, req.query.limit);
        }), {
        description: `Suggest ${cls.name} by specific field`,
        priority: 101, method: 'get', path: '/suggest/:field', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [
          { extract: extractRequest },
          { type: String, name: 'field', location: 'path', extract: () => { } },
          { type: String, name: 'query.q', location: 'query', required: false, extract: () => { } },
          { type: Number, name: 'query.limit', location: 'query', required: false, extract: () => { } }
        ],
        responseType: { description: cls.name, type: cls }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function update(this: Svc, req: Request) {
          return this.source.update(getCls(), await getSchemaInstance(req.body, getCls()));
        }), {
        description: `Update ${cls.name}`,
        priority: 103, method: 'put', path: '/',
        params: [
          { extract: extractRequest },
          { type: cls, location: 'body', extract: () => { } },
        ],
        requestType: { type: cls, description: cls.name },
        responseType: { description: cls.name, type: cls }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function create(this: Svc, req: Request) {
          return this.source.save(getCls(), await getSchemaInstance(req.body, getCls()));
        }), {
        description: `Create ${cls.name}`,
        priority: 104, method: 'post', path: '/',
        params: [
          { extract: extractRequest },
          { type: cls, location: 'body', extract: () => { } },
        ],
        requestType: { type: cls, description: cls.name },
        responseType: { description: cls.name, type: cls }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function remove(this: Svc, req: Request) {
          return this.source.deleteById(getCls(), req.params.id);
        }), {
        params: [
          { extract: extractRequest },
          { type: String, name: 'id', location: 'path', extract: () => { } }
        ],
        description: `Delete ${cls.name} by id`,
        priority: 105, method: 'delete', path: '/:id'
      });

    ControllerRegistry.register(target, {
      basePath: path,
      class: target,
    });
  };
}