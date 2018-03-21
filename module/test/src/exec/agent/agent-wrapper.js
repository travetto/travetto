module.exports = {
  agent(init, run) {
    process.on('message', async function(data) {
      console.log('on message', data);
      if (data.type === 'init') {
        init(_ => process.send({ type: 'initComplete' }));
      } else if (data.type === 'run') {
        run(data, e => {
          let error = undefined;
          if (e) {
            error = {};
            for (let k of Object.keys(e)) {
              error[k] = e[k];
            }
            error.message = e.message;
            error.stack = e.stack;
            error.name = e.name;
          }
          process.send({ type: 'runComplete', error });
        });
      }
    });

    if (process.send) {
      process.send({ type: 'ready' });
      setTimeout(_ => {}, Number.MAX_SAFE_INTEGER);
    }
  }
}