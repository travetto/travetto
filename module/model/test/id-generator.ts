import assert from 'node:assert';

import { Model, ModelCrudUtil, type ModelId, ModelRegistryIndex } from '@travetto/model';
import { Registry } from '@travetto/registry';
import { castTo } from '@travetto/runtime';
import { Match, Schema, SchemaValidator, UUID, ValidationResultError } from '@travetto/schema';
import { Suite, Test } from '@travetto/test';

@Model()
class DefaultModel {
  id: ModelId;
  name: string;
}

@Schema()
class OptionalModel {
  id?: string;
  name: string;
}

@Model()
class UuidValidatedModel {
  @UUID()
  id: ModelId;
  name: string;
}

let counter = 0;
const customPrefix = 'custom-id-';

@Model({
  idGenerator: () => `${customPrefix}${++counter}`
})
class CustomModel {
  @Match(new RegExp(`^${customPrefix}\\d+$`))
  id: ModelId;
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
    const specificId = `${customPrefix}999`;
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

  @Test('Verify ID pattern behavior with and without @UUID')
  async testDefaultIdPattern() {
    await Registry.init();

    // Default model without @UUID accepts arbitrary string id
    const customItem = await ModelCrudUtil.preCreate(DefaultModel, DefaultModel.from({ id: 'arbitrary-custom-id', name: 'valid-custom' }));
    assert(customItem.id === 'arbitrary-custom-id');

    // UuidValidatedModel accepts 32-character hex uuid
    const valid32 = await ModelCrudUtil.preCreate(
      UuidValidatedModel,
      UuidValidatedModel.from({ id: '0123456789abcdef0123456789abcdef', name: 'valid' })
    );
    assert(valid32.id === '0123456789abcdef0123456789abcdef');

    // UuidValidatedModel rejects hyphenated uuid
    await assert.rejects(
      () =>
        ModelCrudUtil.preCreate(
          UuidValidatedModel,
          UuidValidatedModel.from({ id: '01234567-89ab-cdef-0123-456789abcdef', name: 'invalid-hyphenated' })
        ),
      (err: unknown) => err instanceof ValidationResultError && err.details.errors.some(e => e.path === 'id')
    );

    // UuidValidatedModel rejects non-uuid strings
    await assert.rejects(
      () => ModelCrudUtil.preCreate(UuidValidatedModel, UuidValidatedModel.from({ id: 'invalid-not-a-uuid', name: 'invalid' })),
      (err: unknown) => err instanceof ValidationResultError && err.details.errors.some(e => e.path === 'id')
    );
  }

  @Test('Verify direct schema validation respects required vs optional id declarations')
  async testDirectValidationRequiredness() {
    await Registry.init();

    // DefaultModel has id: ModelId (required), so direct validation without id rejects
    await assert.rejects(
      () => SchemaValidator.validate(DefaultModel, castTo({ name: 'Alice' })),
      (err: unknown) => err instanceof ValidationResultError && err.details.errors.some(e => e.path === 'id' && e.kind === 'required')
    );

    // OptionalModel has id?: string (optional), so direct validation without id passes
    const validOptional = await SchemaValidator.validate(OptionalModel, { name: 'Alice' });
    assert(validOptional.id === undefined);
  }

  @Test('Verify preUpdate without id fails validation')
  async testPreUpdateWithoutId() {
    await Registry.init();
    await assert.rejects(
      () => ModelCrudUtil.preUpdate(DefaultModel, DefaultModel.from({ name: 'no-id' })),
      (err: unknown) => err instanceof ValidationResultError && err.details.errors.some(e => e.path === 'id')
    );
  }

  @Test('Verify preUpdate without id and invalid schema returns both validation errors')
  async testPreUpdateWithoutIdAndInvalidSchema() {
    await Registry.init();
    await assert.rejects(
      () => ModelCrudUtil.preUpdate(DefaultModel, DefaultModel.from({ name: '' })),
      (err: unknown) => {
        if (!(err instanceof ValidationResultError)) {
          return false;
        }
        const hasId = err.details.errors.some(e => e.path === 'id' && e.kind === 'required');
        const hasName = err.details.errors.some(e => e.path === 'name' && e.kind === 'required');
        return hasId && hasName && err.details.errors.length >= 2;
      }
    );
  }
}
