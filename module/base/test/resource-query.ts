import assert from 'assert';

import { Suite, Test } from '@travetto/test';
import { FileQueryProvider } from '../src/resource-query';

@Suite()
class ResourceQuerySuite {
  @Test()
  async simpleTest() {
    const found = [];

    for await (const item of FileQueryProvider.query({
      paths: ['@#test/fixtures/query'],
      filter: () => true
    })) {
      found.push(item);
    }

    assert(found.length === 4);
  }

  @Test()
  async simpleHidden() {
    const found = [];

    for await (const item of FileQueryProvider.query({
      paths: ['@#test/fixtures/query'],
      includeHidden: true,
      filter: () => true
    })) {
      found.push(item);
    }

    assert(found.length === 5);
  }

  @Test()
  async testFilter() {
    const found = [];

    for await (const item of FileQueryProvider.query({
      paths: ['@#test/fixtures/query'],
      filter: v => v.startsWith('a/')
    })) {
      found.push(item);
    }

    assert(found.length === 2);

    found.splice(0, found.length);

    for await (const item of FileQueryProvider.query({
      paths: ['@#test/fixtures/query'],
      includeHidden: true,
      filter: v => v.startsWith('a/')
    })) {
      found.push(item);
    }

    // @ts-expect-error
    assert(found.length === 3);
  }
}