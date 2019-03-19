require(`${process.env.TRV_DI_ROOT || '..'}/bin/lib`)
  .computeApps()
  .then(resolved => require('fs').writeSync(1, `${JSON.stringify(resolved)}\n`))
  .catch(err => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });