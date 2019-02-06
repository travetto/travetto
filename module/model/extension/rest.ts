import { ControllerRegistry, Request, Response } from '@travetto/rest';
import { getSchemaBody } from '@travetto/schema/extension/rest';
import { Class } from '@travetto/registry';

import { ModelService, ModelCore } from '../';
import { ValidationErrors } from '../src/error';

type Svc = { source: ModelService };

// tslint:disable:no-invalid-this
(ValidationErrors as Class).prototype.render = function (res: Response) {
  res.status(403);
  res.json(this.toJSON({ status: 403 }));
};
// tslint:enable:no-invalid-this

export function ModelController<T extends ModelCore>(path: string, cls: Class<T>) {
  return (target: Class<Svc>) => {

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function getAll(this: Svc, req: Request) {
          return this.source.getAllByQuery(cls, JSON.parse(req.query.q || '{}'));
        }), {
        description: `Get all ${cls.name}`,
        priority: 101, method: 'get', path: '/', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        responseType: { description: `List of ${cls.name}`, type: cls, wrapper: Array }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function getById(this: Svc, req: Request) {
          return this.source.getById(cls, req.params.id);
        }), {
        description: `Get ${cls.name} by id`,
        priority: 102, method: 'get', path: '/:id', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        responseType: { description: cls.name, type: cls }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function suggestField(this: Svc, req: Request) {
          return this.source.suggestField(cls, req.params.field, req.query.q, req.query.limit);
        }), {
        description: `Suggest ${cls.name} by specific field`,
        priority: 101, method: 'get', path: '/suggest/:field', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        responseType: { description: cls.name, type: cls }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function update(this: Svc, req: Request) {
          return this.source.update(cls, await getSchemaBody(req, cls));
        }), {
        description: `Update ${cls.name}`,
        priority: 103, method: 'put', path: '/',
        requestType: { type: cls, description: cls.name },
        responseType: { description: cls.name, type: cls }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function create(this: Svc, req: Request) {
          return this.source.save(cls, await getSchemaBody(req, cls));
        }), {
        description: `Create ${cls.name}`,
        priority: 104, method: 'post', path: '/',
        requestType: { type: cls, description: cls.name },
        responseType: { description: cls.name, type: cls }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function remove(this: Svc, req: Request) {
          return this.source.deleteById(cls, req.params.id);
        }), {
        description: `Delete ${cls.name} by id`,
        priority: 105, method: 'delete', path: '/:id'
      });

    ControllerRegistry.register(target, {
      basePath: path,
      class: target,
    });
  };
}