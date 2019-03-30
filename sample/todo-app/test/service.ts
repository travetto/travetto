import * as assert from 'assert';

import { Suite, Test, BeforeAll, AfterAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { TodoService } from '../src/service';
import { ModelSource } from '@travetto/model';
import { ElasticsearchModelSource } from '@travetto/model-elasticsearch';

import { Todo } from '../src/model';

require('./config');

@Suite()
export class TodoTest {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
  }

  @AfterAll()
  async destroy() {
    const source = await DependencyRegistry.getInstance(ModelSource);
    (source as ElasticsearchModelSource).resetDatabase();
  }

  @Test('Create todo')
  async create() {
    const svc = await DependencyRegistry.getInstance(TodoService);

    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await svc.add(test);

    assert.ok(saved.id);
  }

  @Test('Complete todo')
  async complete() {
    const svc = await DependencyRegistry.getInstance(TodoService);

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
    const svc = await DependencyRegistry.getInstance(TodoService);

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