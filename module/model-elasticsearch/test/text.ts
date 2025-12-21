import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { LongText, Text, Schema } from '@travetto/schema';

import { ElasticsearchSchemaUtil } from '@travetto/model-elasticsearch/src/internal/schema.ts';

@Schema()
class TextAble {
  @LongText()
  bio: string;

  @Text()
  messages: string[];
}

@Suite()
class TextTestSuite {

  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test()
  async validateTextSchema() {
    const schema = ElasticsearchSchemaUtil.generateSingleMapping(TextAble);

    assert(schema.properties);
    assert(schema.properties.bio);
    assert(schema.properties.bio.type === 'keyword');
    assert(schema.properties.bio.fields);
    assert(schema.properties.bio.fields.text);
    assert(schema.properties.bio.fields.text.type === 'text');

    assert(schema.properties.messages);
    assert(schema.properties.messages.type === 'keyword');
    assert(schema.properties.messages.fields);
    assert(schema.properties.messages.fields.text);
    assert(schema.properties.messages.fields.text.type === 'text');

  }
}