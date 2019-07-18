import * as assert from 'assert';

import { Model, ModelService, ModelCore } from '@travetto/model';
import { Suite, Test } from '@travetto/test';
import { Schema, Text } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';
import { BaseSqlTest } from './base';

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

@Model()
export class Wrapper implements ModelCore {
  id: string;
  content: any;
}

@Suite()
export class NestedSuite extends BaseSqlTest {

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

  @Test()
  async verifyUnindexedObject() {
    const service = await DependencyRegistry.getInstance(ModelService);
    const ret = await service.save(Wrapper, Wrapper.from({
      id: '200',
      content: {
        a: 5,
        b: 6
      }
    }));

    const fetched = await service.getById(Wrapper, ret.id);

    assert(fetched.content === { a: 5, b: 6 });
  }
}