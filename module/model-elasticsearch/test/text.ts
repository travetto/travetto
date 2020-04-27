import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { LongText, Text, Schema } from '@travetto/schema';

import { ElasticsearchUtil } from '../src/util';

@Schema()
class TextAble {
  @LongText()
  bio: string;

  @Text()
  messages: string[];
}

@Suite()
export class TextTestSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async validateTextSchema() {
    const schema = ElasticsearchUtil.generateSingleSourceSchema(TextAble);

    assert(schema.properties);
    assert(schema.properties.bio);
    assert(schema.properties.bio.fields);
    assert(schema.properties.bio.fields.text);
    assert(schema.properties.bio.fields.text.type === 'text');

    assert(schema.properties.messages);
    assert(schema.properties.messages.fields);
    assert(schema.properties.messages.fields.text);
    assert(schema.properties.messages.fields.text.type === 'text');

  }
}