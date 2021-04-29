// @file-if @travetto/model
import { Class } from '@travetto/base';
import { ModelType, ModelCrudSupport, ModelRegistry } from '@travetto/model';
import { Field, SchemaRegistry } from '@travetto/schema';

import { ControllerRegistry } from '../registry/controller';
import { Body, paramConfig } from '../decorator/param';

type Svc = { source: ModelCrudSupport };

/**
 * Provides a basic CRUD routes for a given model:
 *
 * - Create
 * - Read
 * - Update
 * - Delete
 */
export function ModelRoutes<T extends ModelType>(cls: Class<T>) {
  function getCls() {
    return ModelRegistry.get(cls).class as Class<T>;
  }

  return (target: Class<Svc>) => {
    SchemaRegistry.register(target);

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function get(this: Svc, id: string) {
          return this.source.get<ModelType>(getCls(), id);
        }),
      {
        description: `Get ${cls.name} by id`,
        priority: 102, method: 'get', path: '/:id', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        params: [paramConfig('path', { name: 'id' })],
        responseType: { type: cls, description: cls.name }
      }
    );

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function update(this: Svc, body: ModelType) {
          return this.source.update(getCls(), body);
        }),
      {
        description: `Update ${cls.name}`,
        priority: 103, method: 'put', path: '/',
        params: [Body()],
        requestType: { type: cls, description: cls.name },
        responseType: { type: cls, description: cls.name }
      }
    );

    // Register field
    Field(cls)({ constructor: target }, 'update', 0);

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function create(this: Svc, body: ModelType) {
          return this.source.create(getCls(), body);
        }),
      {
        description: `Create ${cls.name}`,
        priority: 104, method: 'post', path: '/',
        params: [Body()],
        requestType: { type: cls, description: cls.name },
        responseType: { type: cls, description: cls.name }
      }
    );

    // Register field
    Field(cls)({ constructor: target }, 'create', 0);


    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function remove(this: Svc, id: string) {
          return this.source.delete(getCls(), id);
        }),
      {
        params: [paramConfig('path', { name: 'id' })],
        description: `Delete ${cls.name} by id`,
        priority: 105, method: 'delete', path: '/:id'
      });
  };
}