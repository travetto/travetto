import { ChildExecution, ExecutionPool } from '../src';

const pool = new ExecutionPool<ChildExecution>({
  count: 2,
  create() {
    const child = new ChildExecution(`${__dirname}/index.js`, true, {
      env: { SRC: './simple.child' }
    });
    child.init();
    (child as any)['ready'] = child.listenOnce('ready');
    return child;

  },
  async init(child: ChildExecution) {
    await (child as any)['ready'];
    return child;
  },
  async exec(inp: string, child: ChildExecution) {
    const wait = child.listenOnce('response');
    child.send('request', { data: inp });
    const res = await wait;
    console.log('Sent', inp, 'Received', res);
  }
});

pool.process(['a', 'b', 'c', 'd', 'e', 'f', 'g']).then(() => {
  console.log('DONE!');
});