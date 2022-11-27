process.on('message', ({ type, data }) => {
  if (type === 'request') {
    console.log(process.pid, 'RECEIVED', data);
    process.send({ type: 'response', data: (data + data) });
  }
});
process.send({ type: 'ready' });