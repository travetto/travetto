const count = +process.argv.pop();

(async () => {
  for (let i = 0; i < count; i += 1) {
    console.log('hi');
    await new Promise(r => setTimeout(r, 50));
  }
})();