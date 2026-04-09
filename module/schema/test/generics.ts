import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { Method, Schema, SchemaRegistryIndex } from '@travetto/schema';

import { GenericArray } from './models/generic';

@Schema()
class GenericItem {
  name: string;
}

/**
 * @virtual true
 */
interface GenericList<T> {
  items: T[];
}

/**
 * Generic response wrapper
 * @see body Wrapped response body #target
 */
class GenericResponse<T> {
  body: T;
}

@Schema()
class GenericContainer {
  value: GenericList<GenericItem>;
}

@Schema()
class GenericMethodContainer {
  @Method()
  async getItems(): Promise<GenericResponse<GenericItem[]>> {
    return new GenericResponse<GenericItem[]>();
  }

  @Method()
  async getArray(): Promise<GenericArray<GenericItem>> {
    return new GenericArray<GenericItem>();
  }
}

@Suite()
class GenericInstantiationSuite {

  @BeforeAll()
  ready() {
    return Registry.init();
  }

  @Test()
  async testGenericInstantiation() {
    const fields = SchemaRegistryIndex.get(GenericContainer).getFields();
    assert(fields.value);

    const valueConfig = SchemaRegistryIndex.get(fields.value.type).getFields();
    assert(valueConfig.items);
    assert(valueConfig.items.array);
    assert(valueConfig.items.type === GenericItem);
  }

  @Test()
  async testInnerTypePropertyResolution() {
    const method = SchemaRegistryIndex.get(GenericMethodContainer).getMethod('getItems');
    assert(method.returnType);
    assert(method.returnType.array);
    assert(method.returnType.type === GenericItem);
  }

  @Test()
  async testGenericClass() {
    const method = SchemaRegistryIndex.get(GenericMethodContainer).getMethod('getArray');
    assert(method.returnType);
    assert(method.returnType.type !== GenericArray);
    assert(Object.getPrototypeOf(method.returnType.type) === GenericArray);
    const children = SchemaRegistryIndex.get(method.returnType.type);
    assert(children.getField('items').type === GenericItem);
  }
}