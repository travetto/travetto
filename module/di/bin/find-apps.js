require(`${process.env.TRV_DI_BASE || '..'}/bin/lib`)
  .computeApps()
  .then(resolved => require('fs').writeSync(1, `${JSON.stringify(resolved)}\n`))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });