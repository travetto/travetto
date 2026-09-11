import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { Max, Method, Min, Schema, SchemaRegistryIndex } from '@travetto/schema';
import { BeforeAll, Suite, Test } from '@travetto/test';

@Schema()
class Base {
  id: string;
  name: string;
  @Max(110) @Min(1) age?: number;
}

type Picked = Pick<Base, 'name' | 'age'>;
type Omitted = Omit<Base, 'id'>;
type Part = Partial<Base>;
type Req = Required<Base>;

type Mixed = Pick<Base, 'name'> & Pick<Base, 'age'>;

@Schema()
class Container {
  picked: Picked;
  omitted: Omitted;
  part: Part;
  req: Req;
  mixed: Mixed;

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
    assert(pickedConfig.getFields().age.min?.limit === 1);
    assert(pickedConfig.getFields().age.max?.limit === 110);

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

  @Test()
  async testComplexMappedChainsAreFlattened() {
    const field = SchemaRegistryIndex.getNestedFieldConfig(Container, 'mixed');
    assert(field);

    const mixed = SchemaRegistryIndex.get(field.type);
    assert(mixed);
    assert(mixed.getField('age'));
    assert(mixed.getField('name'));
    assert(!mixed.getField('id'));
  }
}
