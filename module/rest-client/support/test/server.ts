import os from 'node:os';
import assert from 'node:assert';
import path from 'node:path';

import { BeforeAll, Suite, Test } from '@travetto/test';
import { InjectableSuite } from '@travetto/di/support/test/suite';
import { BaseRestSuite } from '@travetto/rest/support/test/base';
import { Util } from '@travetto/runtime';
import { Inject } from '@travetto/di';

import { RestClientGeneratorService } from '../../src/service';
import { Todo } from './service';
import { RestClientTestUtil } from './util';

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

@InjectableSuite()
@Suite()
export abstract class RestClientServerSuite extends BaseRestSuite {

  @Inject()
  svc: RestClientGeneratorService;

  @BeforeAll()
  async setupPuppeteer(): Promise<void> {
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
    const result = await RestClientTestUtil.runNodeClient(this.svc, fetchRequestBody('./src', this.port!));
    this.validateFetchResponses(result);
  }

  @Test({ timeout: 10000 })
  async fetchWebClient() {
    const result = await RestClientTestUtil.runWebClient(this.svc, fetchRequestBody('./api.js', this.port!));
    this.validateFetchResponses(result);
  }

  @Test({ timeout: 10000 })
  async angularClient() {
    const tmp = path.resolve(os.tmpdir(), `rest-client-angular-${Util.uuid()}`);
    try {
      await this.svc.renderClient({ type: 'angular', output: tmp });
    } finally {
      await RestClientTestUtil.cleanupFolder(tmp);
    }
  }
}