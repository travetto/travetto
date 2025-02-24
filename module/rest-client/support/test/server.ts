import assert from 'node:assert';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { RootRegistry } from '@travetto/registry';

import { BaseRestSuite } from '@travetto/rest/support/test/base.ts';

import { Todo } from './service.ts';
import { RestClientTestUtil } from './util.ts';

function fetchRequestBody(from: string, port: number): string {
  return `
import { TodoApi } from '${from}';
const api = new TodoApi({ baseUrl: 'http://localhost:${port}', timeout: 100 });
  
async function go() {
  const items = [];
  const log = v => items.push(v);
  log(await api.listTodo(200, 50, ['a','b','c'], 'green-2'));
  log(await api.createTodo({id: '10', text:'todo', priority: 11}));
  log(await api.getName('Roger'));

  try {
    const result = await api.getLong(''+api.timeout);
    log('FAILED TO ERROR');
  } catch (err) {
    log(err.message);
  }

  return JSON.stringify(items);
}
`;
}

@Suite()
export abstract class RestClientServerSuite extends BaseRestSuite {

  @BeforeAll()
  async setupPuppeteer(): Promise<void> {
    await RootRegistry.init();
    await RestClientTestUtil.setupPuppeteer();
  }

  @Test({ skip: true })
  validateFetchResponses(text: string): void {
    assert(/^\[/.test(text.trim()));
    const items: [Todo[], Todo, string, string] = JSON.parse(text);
    assert(items.length === 4);

    const body0 = items[0][0];
    assert(body0.id === '200');
    assert(body0.priority === 50);
    assert(body0.text === 'todo-a-b-c');
    assert(body0.color === 'green-2');

    const body1 = items[1];
    assert(body1.id === '10');
    assert(body1.text === 'todo');
    assert(body1.priority === 11);

    assert(items[2] === 'Roger');

    assert(/abort/i.test(items[3]));
  }

  @Test({ timeout: 10000 })
  async fetchNodeClient() {
    const result = await RestClientTestUtil.runNodeClient(fetchRequestBody('./src.ts', this.port!));
    this.validateFetchResponses(result);
  }

  @Test({ timeout: 10000 })
  async fetchWebClient() {
    const result = await RestClientTestUtil.runWebClient(fetchRequestBody('./api.js', this.port!));
    this.validateFetchResponses(result);
  }

  @Test({ timeout: 10000 })
  async angularClient() {
    await RestClientTestUtil.runAngularClient();
  }
}