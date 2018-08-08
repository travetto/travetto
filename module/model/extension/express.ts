import { Request } from 'express';

import { ControllerRegistry } from '@travetto/express';
import { getSchemaBody } from '@travetto/schema/extension/express';
import { Class } from '@travetto/registry';

import { BaseModel, ModelService } from '../src';

type Svc = { source: ModelService };

export function ModelController<T extends BaseModel>(path: string, cls: Class<T>) {
  return (target: Class<Svc>) => {

    const parent = ControllerRegistry.getOrCreatePending(target);
    const paths = new Set((parent.endpoints || []).map(ep => `${ep.method}#${ep.path}`));

    if (!paths.has('get#/')) {
      Object.assign(
        ControllerRegistry.getOrCreateEndpointConfig(
          target, async function (this: Svc, req: Request) {
            return this.source.getAllByQuery(cls, JSON.parse(req.params.q || '{}'));
          }), {
          method: 'get', path: '/', headers: {
            Expires: '-1',
            'Cache-Control': 'max-age=0, no-cache'
          }
        }
      );
    }

    if (!paths.has('get#/:id')) {
      Object.assign(
        ControllerRegistry.getOrCreateEndpointConfig(
          target, async function (this: Svc, req: Request) {
            return this.source.getById(cls, req.params.id);
          }), {
          method: 'get', path: '/:id', headers: {
            Expires: '-1',
            'Cache-Control': 'max-age=0, no-cache'
          }
        }
      );
    }

    if (!paths.has('put#/')) {
      Object.assign(
        ControllerRegistry.getOrCreateEndpointConfig(
          target, async function (this: Svc, req: Request) {
            return this.source.update(cls, await getSchemaBody(req, cls));
          }), { method: 'put', path: '/' });
    }

    if (!paths.has('post#/')) {
      Object.assign(
        ControllerRegistry.getOrCreateEndpointConfig(
          target, async function (this: Svc, req: Request) {
            return this.source.save(cls, await getSchemaBody(req, cls));
          }), { method: 'post', path: '/' });
    }

    if (!paths.has('delete#/:id')) {
      Object.assign(
        ControllerRegistry.getOrCreateEndpointConfig(
          target, async function (this: Svc, req: Request) {
            return this.source.deleteById(cls, req.params.id);
          }), { method: 'delete', path: '/:id' });
    }

    ControllerRegistry.register(target, {
      path,
      class: target,
    });
  };
}