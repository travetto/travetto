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
    assert(picked?.type.kind === 'complex');
    // Verify structure of picked.type
    const pickedConfig = SchemaRegistryIndex.get(picked.type.value);
    assert(pickedConfig.getFields().name);
    assert(pickedConfig.getFields().age);
    assert(!pickedConfig.getFields().id);
    assert(pickedConfig.getFields().age.min?.limit === 1);
    assert(pickedConfig.getFields().age.max?.limit === 110);

    const omitted = config.getFields().omitted;
    assert(omitted?.type.kind === 'complex');
    const omittedConfig = SchemaRegistryIndex.get(omitted.type.value);
    assert(omittedConfig.getFields().name);
    assert(omittedConfig.getFields().age);
    assert(!omittedConfig.getFields().id);

    const part = config.getFields().part;
    assert(part?.type.kind === 'complex');
    const partConfig = SchemaRegistryIndex.get(part.type.value);
    assert(!partConfig.getFields().id.required?.active);
    assert(!partConfig.getFields().name.required?.active);

    const req = config.getFields().req;
    assert(req?.type.kind === 'complex');
    const reqConfig = SchemaRegistryIndex.get(req.type.value);
    assert(reqConfig.getFields().age.required?.active);
  }

  @Test()
  async testMappedTypeParameters() {
    const method = SchemaRegistryIndex.get(Container).getMethod('process');
    assert(method);

    const p = method.parameters[0];
    assert(p?.type.kind === 'complex');
    const pConfig = SchemaRegistryIndex.get(p.type.value);
    assert(pConfig.getFields().name);
    assert(!pConfig.getFields().id);

    const o = method.parameters[1];
    assert(o?.type.kind === 'complex');
    const oConfig = SchemaRegistryIndex.get(o.type.value);
    assert(oConfig.getFields().name);
    assert(!oConfig.getFields().id);
  }

  @Test()
  async testInlineMappedTypes() {
    const method = SchemaRegistryIndex.get(Container).getMethod('processInline');
    assert(method);

    const p = method.parameters[0];
    assert(p?.type.kind === 'complex');
    const pConfig = SchemaRegistryIndex.get(p.type.value);
    assert(pConfig.getFields().name);
    assert(!pConfig.getFields().id);
    assert(!pConfig.getFields().age);

    const r = method.parameters[1];
    assert(r?.type.kind === 'complex');
    const rConfig = SchemaRegistryIndex.get(r.type.value);
    assert(rConfig.getFields().age.required?.active);
  }

  @Test()
  async testComplexMappedChainsAreFlattened() {
    const field = SchemaRegistryIndex.getNestedFieldConfig(Container, 'mixed');
    assert(field?.type.kind === 'complex');

    const mixed = SchemaRegistryIndex.get(field.type.value);
    assert(mixed);
    assert(mixed.getField('age'));
    assert(mixed.getField('name'));
    assert(!mixed.getField('id'));
  }
}
