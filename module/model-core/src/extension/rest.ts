// @file-if @travetto/rest
import { ControllerRegistry, paramConfig } from '@travetto/rest';
import { schemaParamConfig } from '@travetto/schema/src/extension/rest';
import { Class } from '@travetto/registry';

import { ModelType } from '../types/model';
import { ModelCore } from '../service/core';
import { ModelRegistry } from '../registry/registry';

type Svc = { source: ModelCore };

/**
 * Provides a basic CRUD controller for a given model:
 *
 * - Create
 * - Read
 * - Update
 * - Delete
 *
 * @augments `@trv:di/Injectable`
 */
export function ModelController<T extends ModelType>(path: string, cls: Class<T>) {
  function getCls() {
    return ModelRegistry.get(cls).class;
  }

  return (target: Class<Svc>) => {
    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(
        target, function getById(this: Svc, id: string) {
          return this.source.get(getCls(), id);
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
          return this.source.create(getCls(), body);
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
          return this.source.delete(getCls(), id);
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