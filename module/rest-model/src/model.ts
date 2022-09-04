import { Class } from '@travetto/base';
import { ModelType, ModelCrudSupport, ModelRegistry } from '@travetto/model';
import { Field, SchemaRegistry } from '@travetto/schema';
import { ControllerRegistry } from '@travetto/rest';

type Svc = { source: ModelCrudSupport };

/**
 * Provides a basic CRUD routes for a given model:
 *
 * - Create
 * - Read
 * - Update
 * - Delete
 */
export function ModelRoutes<T extends ModelType>(cls: Class<T>): (target: Class<Svc>) => void {
  function getCls(): Class<T> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return ModelRegistry.get(cls).class as Class<T>;
  }

  return (target: Class<Svc>): void => {
    SchemaRegistry.register(target);
    const inst = { constructor: target };

    function get(this: Svc, id: string): Promise<T> {
      return this.source.get<T>(getCls(), id);
    }

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(target, get),
      {
        description: `Get ${cls.name} by id`,
        priority: 102, method: 'get', path: '/:id', headers: {
          Expires: '-1',
          'Cache-Control': 'max-age=0, no-cache'
        },
        responseType: { type: cls, description: cls.name }
      }
    );

    // Register field
    ControllerRegistry.registerEndpointParameter(target, get, { name: 'id', location: 'path' }, 0);
    Field(String, { required: { active: true } })(inst, 'get', 0);

    function update(this: Svc, body: T): Promise<T> {
      return this.source.update(getCls(), body);
    }

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(target, update),
      {
        description: `Update ${cls.name}`,
        priority: 103, method: 'put', path: '/',
        requestType: { type: cls, description: cls.name },
        responseType: { type: cls, description: cls.name }
      }
    );

    // Register field
    ControllerRegistry.registerEndpointParameter(target, update, { name: 'body', location: 'body' }, 0);
    Field(cls)({ constructor: target }, 'update', 0);

    function create(this: Svc, body: T): Promise<T> {
      return this.source.create(getCls(), body);
    }

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(target, create),
      {
        description: `Create ${cls.name}`,
        priority: 104, method: 'post', path: '/',
        requestType: { type: cls, description: cls.name },
        responseType: { type: cls, description: cls.name }
      }
    );

    // Register field
    ControllerRegistry.registerEndpointParameter(target, create, { name: 'body', location: 'body' }, 0);
    Field(cls)(inst, 'create', 0);

    function remove(this: Svc, id: string): Promise<void> {
      return this.source.delete(getCls(), id);
    }

    Object.assign(
      ControllerRegistry.getOrCreateEndpointConfig(target, remove),
      {
        description: `Delete ${cls.name} by id`,
        priority: 105, method: 'delete', path: '/:id'
      });

    // Register field
    ControllerRegistry.registerEndpointParameter(target, remove, { name: 'id', location: 'path' }, 0);
    Field(String, { required: { active: true } })(inst, 'remove', 0);
  };
}