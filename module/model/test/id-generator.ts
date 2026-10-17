import assert from 'node:assert';

import { Model, ModelCrudUtil, ModelRegistryIndex } from '@travetto/model';
import { Registry } from '@travetto/registry';
import { Suite, Test } from '@travetto/test';

@Model()
class DefaultModel {
  id: string;
  name: string;
}

let counter = 0;
const customPrefix = 'custom-id-';

@Model({
  idGenerator: () => `${customPrefix}${++counter}`
})
class CustomModel {
  id: string;
  value: string;
}

@Model()
class InheritedModel extends CustomModel {
  extra: string;
}

@Model({
  idGenerator: () => `overridden-${++counter}`
})
class OverriddenModel extends CustomModel {
  other: string;
}

@Suite()
export class ModelIdGeneratorSuite {
  @Test('Verify default ID generator is 32 character uuid')
  async testDefaultIdGenerator() {
    await Registry.init();
    const config = ModelRegistryIndex.getConfig(DefaultModel);
    assert(typeof config.idGenerator === 'function');

    const generatedId = config.idGenerator();
    assert(generatedId.length === 32);
    assert(/^[0-9a-f]{32}$/i.test(generatedId));

    const secondId = config.idGenerator();
    assert(secondId.length === 32);
    assert(generatedId !== secondId);
  }

  @Test('Verify custom ID generator on ModelConfig')
  async testCustomIdGenerator() {
    await Registry.init();
    const config = ModelRegistryIndex.getConfig(CustomModel);
    assert(typeof config.idGenerator === 'function');

    const id1 = config.idGenerator();
    assert(id1.startsWith(customPrefix));

    const id2 = config.idGenerator();
    assert(id2.startsWith(customPrefix));
    assert(id1 !== id2);
  }

  @Test('Verify preCreate uses model idGenerator when id is omitted')
  async testPreCreateUsesIdGenerator() {
    await Registry.init();
    const defaultItem = await ModelCrudUtil.preCreate(DefaultModel, DefaultModel.from({ name: 'test' }));
    assert(defaultItem.id !== undefined);
    assert(defaultItem.id.length === 32);

    const customItem = await ModelCrudUtil.preCreate(CustomModel, CustomModel.from({ value: 'val' }));
    assert(customItem.id !== undefined);
    assert(customItem.id.startsWith(customPrefix));
  }

  @Test('Verify preCreate preserves provided id')
  async testPreCreatePreservesId() {
    await Registry.init();
    const specificId = 'explicit-id-123';
    const item = await ModelCrudUtil.preCreate(CustomModel, CustomModel.from({ id: specificId, value: 'val' }));
    assert(item.id === specificId);
  }

  @Test('Verify preUpsert uses model idGenerator when id is omitted')
  async testPreUpsertUsesIdGenerator() {
    await Registry.init();
    const customItem = await ModelCrudUtil.preUpsert(CustomModel, CustomModel.from({ value: 'val' }));
    assert(customItem.id !== undefined);
    assert(customItem.id.startsWith(customPrefix));
  }

  @Test('Verify inheritance of idGenerator')
  async testInheritance() {
    await Registry.init();
    const inheritedConfig = ModelRegistryIndex.getConfig(InheritedModel);
    const inheritedId = inheritedConfig.idGenerator();
    assert(inheritedId.startsWith(customPrefix));

    const overriddenConfig = ModelRegistryIndex.getConfig(OverriddenModel);
    const overriddenId = overriddenConfig.idGenerator();
    assert(overriddenId.startsWith('overridden-'));
  }
}
