import { ControllerRegistry, Request } from '@travetto/rest';
import { getSchemaBody } from '@travetto/schema/extension/rest';
import { Class } from '@travetto/registry';

import { ModelService, ModelCore } from '../';

type Svc = { source: ModelService };

export function ModelController<T extends ModelCore>(path: string, cls: Class<T>) {
  return (target: Class<Svc>) => {

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function (this: Svc, req: Request) {
          return this.source.getAllByQuery(cls, JSON.parse(req.query.q || '{}'));
        }), {
        priority: 101, method: 'get', path: '/', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function (this: Svc, req: Request) {
          return this.source.getById(cls, req.params.id);
        }), {
        priority: 102, method: 'get', path: '/:id', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function (this: Svc, req: Request) {
          return this.source.update(cls, await getSchemaBody(req, cls));
        }), { priority: 103, method: 'put', path: '/' });

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function (this: Svc, req: Request) {
          return this.source.save(cls, await getSchemaBody(req, cls));
        }), { priority: 104, method: 'post', path: '/' });

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, async function (this: Svc, req: Request) {
          return this.source.deleteById(cls, req.params.id);
        }), { priority: 105, method: 'delete', path: '/:id' });

    ControllerRegistry.register(target, {
      basePath: path,
      class: target,
    });
  };
}