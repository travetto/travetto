const { serialize } = require('./error');

module.exports = {
  agent(init, run) {
    process.on('message', async function(data) {
      console.log('on message', data);
      if (data.type === 'init') {
        init(_ => process.send({ type: 'initComplete' }));
      } else if (data.type === 'run') {
        run(data, e => {
          process.send({ type: 'runComplete', error: serialize(e) });
        });
      }
    });

    if (process.send) {
      process.send({ type: 'ready' });
      setTimeout(_ => {}, Number.MAX_SAFE_INTEGER);
    }
  }
}