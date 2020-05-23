import * as https from 'https';
import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { HttpRequest } from '../src/request';

@Suite()
export class RequestTest {

  @Test()
  testArgs() {
    const args = HttpRequest.buildRequestContext({
      url: 'https://a:b@google.com:442?q=hello',
      payload: {
        age: 20,
        height: 5
      }
    });

    assert(args.opts.method === 'GET');
    assert(args.opts.port === '442');
    assert(args.opts.auth === 'a:b');
    assert(args.opts.protocol === 'https:');
    assert(args.client === https);
    assert(args.opts.path === '/?q=hello&age=20&height=5');

    const payload = 'age=20&height=5';
    const args2 = HttpRequest.buildRequestContext({
      url: 'https://google.com?q=hello',
      payload
    });

    assert(args2.opts.path, '/?q=hello&age=20&height=5');

    const args2b = HttpRequest.withJSONPayload({
      url: 'https://google.com?q=hello',
      payload
    });

    assert(args2b.headers!['Content-Type'], 'application/json');

    const payload3 = { age: 20, height: 5 };
    const args3 = HttpRequest.withJSONPayload({
      method: 'POST',
      url: 'https://google.com?q=hello',
      payload: payload3
    });
    assert(args3.method === 'POST');

    const args3b = HttpRequest.buildRequestContext({
      method: 'POST',
      url: 'https://google.com?q=hello',
      payload: JSON.stringify(payload3)
    });
    assert(args3b.opts.headers!['Content-Length'] === JSON.stringify(payload3).length);
  }

  // @Test()
  async testRealCall() {
    const req = await HttpRequest.exec({ url: 'https://jsonplaceholder.typicode.com/todos/1' });
    assert(req.trim().length > 0);
  }
}