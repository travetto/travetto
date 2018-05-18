import { Request, Response } from 'express';
import { Class } from '@travetto/registry';
import { BaseModel, ClassModelService } from '@travetto/model';

import { ControllerRegistry } from '../src/service/registry';

export function ModelController<T extends BaseModel>(path: string, cls: Class<T>): ClassDecorator {
  return (target: Class) => {

    Object.assign(
      ControllerRegistry.getOrCreateRequestHandlerConfig(
        target, async (req: Request) => {
          return { message: 'getAll' }
        }), {
        method: 'get', path: '/', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateRequestHandlerConfig(
        target, async (req: Request) => {
          return { message: 'get', id: req.params.id }
        }), {
        method: 'get', path: '/:id', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateRequestHandlerConfig(
        target, async (req: Request) => {
          return { message: 'put', body: req.body }
        }), { method: 'put', path: '/' });

    Object.assign(
      ControllerRegistry.getOrCreateRequestHandlerConfig(
        target, async (req: Request) => {
          return { message: 'post', body: req.body }
        }), { method: 'post', path: '/' });

    Object.assign(
      ControllerRegistry.getOrCreateRequestHandlerConfig(
        target, async (req: Request) => {
          return { message: 'post', body: req.body }
        }), { method: 'post', path: '/' });

    Object.assign(
      ControllerRegistry.getOrCreateRequestHandlerConfig(
        target, async (req: Request) => {
          return { message: 'delete', id: req.params.id }
        }), { method: 'delete', path: '/:id' });

    ControllerRegistry.register(target, {
      path,
      class: target,
    });
  }
}