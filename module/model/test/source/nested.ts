import * as assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { Schema, Text } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';

import { BaseModelTest } from '../../extension/base.test';
import { Model, ModelService, ModelCore } from '../..';

@Schema()
export class NoteEntity {
  @Text()
  label: string;
  id: string;
}

@Model()
export class Note implements ModelCore {
  id: string;
  entities?: NoteEntity[];
}

export abstract class BaseNestedSuite extends BaseModelTest {

  @Test()
  async verifyQuery() {
    const service = await DependencyRegistry.getInstance(ModelService);

    await service.save(Note, Note.from({
      id: '10',
      entities: [
        {
          label: 'hi',
          id: '10'
        }
      ]
    }));

    const out = await service.getAllByQuery(Note, {
      where: {
        entities: {
          id: '10'
        }
      }
    });

    assert(out.length > 0);
  }
}