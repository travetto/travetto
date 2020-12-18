import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { BaseModelSuite } from '@travetto/model-core/test/lib/test.base';
// import { BaseSQLModelTest } from '@travetto/model-sql/support/test.model-sql';

import { TodoService } from '../src/service';
import { Todo } from '../src/model';
import { ModelCrudSupport } from '@travetto/model-core';

@Suite()
export class TodoTest extends BaseModelSuite<ModelCrudSupport> {

  get svc() {
    return DependencyRegistry.getInstance(TodoService);
  }

  @Test('Create todo')
  async create() {
    const svc = await this.svc;

    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await svc.add(test);

    assert.ok(saved.id);
  }

  @Test('Complete todo')
  async complete() {
    const svc = await this.svc;

    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await svc.add(test);
    assert.ok(saved.id);

    let updated = await svc.complete(saved.id!);
    assert(updated.completed === true);

    updated = await svc.complete(saved.id!, false);
    assert(updated.completed === false);
  }

  @Test('Delete todo')
  async remove() {
    const svc = await this.svc;

    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await svc.add(test);
    assert.ok(saved.id);
    assert(test.text === 'Sample Task');

    await svc.remove(saved.id!);

    try {
      await svc.get(saved.id!);
    } catch (e) {
      assert(e.message);
    }
  }
}