import assert from 'node:assert';

import { Suite, Test } from '@travetto/test';
import { ModelCrudSupport } from '@travetto/model';
import { BaseModelSuite } from '@travetto/model/support/test/base.ts';
import { $_modelConfig_$, $_modelService_$ } from '$_modelImport_$';

import { Todo } from '../../src/model/todo.ts';

@Suite('Simple CRUD')
class TestCRUD extends BaseModelSuite<ModelCrudSupport> {

  serviceClass = $_modelService_$;
  configClass = $_modelConfig_$;

  @Test('save it')
  async save(): Promise<void> {
    const svc = await this.service;

    const saved = await svc.create(Todo, Todo.from({
      text: 'A saved todo',
      completed: false
    }));

    assert(saved.id !== undefined);
  }
}