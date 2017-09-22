export function agent(init, run) {
  process.env.ENV = 'test';
  process.env.NO_WATCH = true;

  let Compiler;

  process.on('message', async function(data) {
    console.log('on message', arguments);
    if (data.type === 'init') {
      require('@encore2/base/bootstrap');
      init(() =>
        process.send({ type: 'initComplete' }));
    } else if (data.type === 'run') {
      Compiler.workingSets = [data.file];
      Compiler.resetFiles();
      run((e) => {
        process.send({ type: 'runComplete', error: e });
      });
    }
  });

  if (process.send) {
    process.send({ type: 'ready' });
    setTimeout(_ => {}, Number.MAX_SAFE_INTEGER);
  }
}