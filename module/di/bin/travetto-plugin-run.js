require(`${process.env.TRV_DI_BASE || '..'}/bin/lib`)
  .runApp(process.argv.slice(2)) // If loaded directly as main entry, run, idx 2 is where non-node arguments start at
  .catch(err => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });