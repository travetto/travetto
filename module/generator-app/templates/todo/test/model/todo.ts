import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeAll, AfterEach } from '@travetto/test';
import { ModelService, ModelRegistry, ModelSource } from '@travetto/model';
import { SchemaRegistry } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';

import { Todo } from '../../src/model/todo';

// Import with side effects as test will not automatically scan all files due to performance
require('../config');

@Suite('Simple CRUD')
class TestCRUD {

  @BeforeAll()
  async before() {
    await RootRegistry.init();
  }

  @AfterEach()
  async afterEach() {
    const mms = (await DependencyRegistry.getInstance(ModelSource)) as any;
    return await mms.resetDatabase();
  }

  @Test('save it')
  async save() {
    const service = await DependencyRegistry.getInstance(ModelService);

    const saved = await service.save(Todo, Todo.from({
      text: 'A saved todo',
      completed: false
    }));

    assert(saved.id !== undefined);
  }
}