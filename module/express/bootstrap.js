require('@encore/config/bootstrap')
  .init(process.env.env || 'local', 'src/app/route/**/*.ts');