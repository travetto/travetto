import * as assert from 'assert';

import { Model, ModelService, ModelCore } from '@travetto/model';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { SchemaRegistry, Schema, Text } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';
import { BaseElasticsearchTest } from './base';

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

@Suite()
export class NestedSuite extends BaseElasticsearchTest {

  @BeforeAll()
  async init() {
    await SchemaRegistry.init();
    await DependencyRegistry.init();
  }

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