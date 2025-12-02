import assert from 'node:assert';

import { Suite, Test, BeforeAll } from '@travetto/test';
import { Registry } from '@travetto/registry';
import { Schema, SchemaRegistryIndex, Method } from '@travetto/schema';

@Schema()
class Base {
  id: string;
  name: string;
  age?: number;
}

type Picked = Pick<Base, 'name' | 'age'>;
type Omitted = Omit<Base, 'id'>;
type Part = Partial<Base>;
type Req = Required<Base>;

@Schema()
class Container {
  picked: Picked;
  omitted: Omitted;
  part: Part;
  req: Req;

  @Method()
  process(p: Picked, o: Omitted) {
    // Do nothing
  }

  @Method()
  processInline(p: Pick<Base, 'name'>, r: Required<Base>) {
    // Do nothing
  }
}

@Suite()
class MappedTypeSuite {

  @BeforeAll()
  ready() {
    return Registry.init();
  }

  @Test()
  async testMappedTypes() {
    const config = SchemaRegistryIndex.get(Container);
    assert(config);

    const picked = config.getFields().picked;
    assert(picked);
    // Verify structure of picked.type
    const pickedConfig = SchemaRegistryIndex.get(picked.type);
    assert(pickedConfig.getFields().name);
    assert(pickedConfig.getFields().age);
    assert(!pickedConfig.getFields().id);

    const omitted = config.getFields().omitted;
    assert(omitted);
    const omittedConfig = SchemaRegistryIndex.get(omitted.type);
    assert(omittedConfig.getFields().name);
    assert(omittedConfig.getFields().age);
    assert(!omittedConfig.getFields().id);

    const part = config.getFields().part;
    assert(part);
    const partConfig = SchemaRegistryIndex.get(part.type);
    assert(!partConfig.getFields().id.required?.active);
    assert(!partConfig.getFields().name.required?.active);

    const req = config.getFields().req;
    assert(req);
    const reqConfig = SchemaRegistryIndex.get(req.type);
    assert(reqConfig.getFields().age.required?.active);
  }

  @Test()
  async testMappedTypeParameters() {
    const method = SchemaRegistryIndex.get(Container).getMethod('process');
    assert(method);

    const p = method.parameters[0];
    assert(p);
    const pConfig = SchemaRegistryIndex.get(p.type);
    assert(pConfig.getFields().name);
    assert(!pConfig.getFields().id);

    const o = method.parameters[1];
    assert(o);
    const oConfig = SchemaRegistryIndex.get(o.type);
    assert(oConfig.getFields().name);
    assert(!oConfig.getFields().id);
  }

  @Test()
  async testInlineMappedTypes() {
    const method = SchemaRegistryIndex.get(Container).getMethod('processInline');
    assert(method);

    const p = method.parameters[0];
    assert(p);
    const pConfig = SchemaRegistryIndex.get(p.type);
    assert(pConfig.getFields().name);
    assert(!pConfig.getFields().id);
    assert(!pConfig.getFields().age);

    const r = method.parameters[1];
    assert(r);
    const rConfig = SchemaRegistryIndex.get(r.type);
    assert(rConfig.getFields().age.required?.active);
  }
}
