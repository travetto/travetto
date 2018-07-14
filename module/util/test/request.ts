import * as https from 'https';
import * as assert from 'assert';
import { Request } from '../src/request';

const args = Request.args({
  url: 'https://a:b@google.com:442?q=hello'
}, {
    age: 20,
    height: 5
  });

assert.strictEqual(args.opts.method, 'GET');
assert.strictEqual(args.opts.port, '442');
assert.strictEqual(args.opts.auth, 'a:b');
assert(!args.opts.protocol);
assert.strictEqual(args.client, https);
assert.strictEqual(args.opts.path, '/?q=hello&age=20&height=5');

const payload = 'age=20&height=5';
const args2 = Request.jsonArgs({
  url: 'https://google.com?q=hello'
}, payload);

assert.strictEqual(args2.opts.path, '/?q=hello&age=20&height=5');
assert.strictEqual(args2.opts.headers['Content-Type'], 'application/json');

const payload3 = { age: 20, height: 5 };
const args3 = Request.jsonArgs({
  method: 'POST',
  url: 'https://google.com?q=hello'
}, payload3);

assert.strictEqual(args3.opts.headers['Content-Length'], JSON.stringify(payload3).length);
assert.strictEqual(args3.opts.method, 'POST');
