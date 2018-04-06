import { ChildExecution, ExecutionPool, ArrayDataSource } from '../src';

const pool = new ExecutionPool<ChildExecution>(async () => {
  const child = new ChildExecution(`${__dirname}/index.js`, true, {
    env: { SRC: './simple.child' }
  });
  child.init();
  await child.listenOnce('ready');
  return child;

}, { max: 2 });

pool.process(
  new ArrayDataSource(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
  async (i: string, exe: ChildExecution) => {
    exe.send('request', { data: i });
    const { data } = await exe.listenOnce('resposne');
    console.log('Sent', i, 'Received', data);
    await new Promise(r => setTimeout(r, 1000));
  }
).then(() => {
  console.log('DONE!');
  pool.shutdown();
});