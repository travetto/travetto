import * as https from 'https';
import * as assert from 'assert';
import { Suite, Test } from '@travetto/test';

import { HttpRequest } from '../src/request';

@Suite()
export class RequestTest {

  @Test()
  testArgs() {
    const args = HttpRequest.args({
      url: 'https://a:b@google.com:442?q=hello'
    }, {
        age: 20,
        height: 5
      });

    assert(args.opts.method === 'GET');
    assert(args.opts.port === '442');
    assert(args.opts.auth === 'a:b');
    assert(args.opts.protocol === undefined);
    assert(args.client === https);
    assert(args.opts.path === '/?q=hello&age=20&height=5');

    const payload = 'age=20&height=5';
    const args2 = HttpRequest.jsonArgs({
      url: 'https://google.com?q=hello'
    }, payload);

    assert(args2.opts.path, '/?q=hello&age=20&height=5');
    assert(args2.opts.headers['Content-Type'], 'application/json');

    const payload3 = { age: 20, height: 5 };
    const args3 = HttpRequest.jsonArgs({
      method: 'POST',
      url: 'https://google.com?q=hello'
    }, payload3);

    assert(args3.opts.headers['Content-Length'] === JSON.stringify(payload3).length);
    assert(args3.opts.method === 'POST');
  }
}