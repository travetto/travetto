import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Inject } from '@travetto/di';
import { MongoModelConfig, MongoModelService } from '@travetto/model-mongo';
import { InjectableSuite } from '@travetto/di/support/test.suite';
import { ModelSuite } from '@travetto/model/support/test/suite';

import { TodoService } from '../src/service';
import { Todo } from '../src/model';

@Suite()
@ModelSuite()
@InjectableSuite()
export class TodoTest {

  serviceClass = MongoModelService;
  configClass = MongoModelConfig;

  @Inject()
  svc: TodoService;

  @Test('Create todo')
  async create() {
    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await this.svc.add(test);

    assert.ok(saved.id);
  }

  @Test('Complete todo')
  async complete() {
    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await this.svc.add(test);
    assert.ok(saved.id);

    let updated = await this.svc.complete(saved.id);
    assert(updated.completed === true);

    updated = await this.svc.complete(saved.id, false);
    assert(updated.completed === false);
  }

  @Test('Delete todo')
  async remove() {
    const test = Todo.from({
      text: 'Sample Task'
    });

    const saved = await this.svc.add(test);
    assert.ok(saved.id);
    assert(test.text === 'Sample Task');

    await this.svc.remove(saved.id);

    try {
      await this.svc.get(saved.id);
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
      assert(err.message);
    }
  }
}