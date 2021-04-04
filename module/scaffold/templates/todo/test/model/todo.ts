import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { ModelCrudSupport } from '@travetto/model';
import { BaseModelSuite } from '@travetto/model/test-support/base';

import { Todo } from '../../src/model/todo';

@Suite('Simple CRUD')
class TestCRUD extends BaseModelSuite<ModelCrudSupport>  {

  @Test('save it')
  async save() {
    const svc = await this.service;

    const saved = await svc.create(Todo, Todo.from({
      text: 'A saved todo',
      completed: false
    }));

    assert(saved.id !== undefined);
  }
}