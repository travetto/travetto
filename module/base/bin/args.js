const commander = require('commander');

const program = commander
  .usage('[-p <profile>] [--profile profile] [--profile profile2] [--watch <boolean>] [--env dev|test|e2e|prod] <application>')
  .arguments('<application>')
  .version(require(`${__dirname}/../package.json`).version)
  .option('-e, --env <env>', 'Application environment', /^(dev|test|e2e|prod)$/i, 'dev')
  .option('-w, --watch [watch]', 'Run the application in watch mode', x => /^(true|yes|on)$/i.test(x), false)
  .option('-p, --profile <profile>', 'Specify additional application profiles', (v, ls) => { ls.push(v); }, [])
  .parse(process.argv);

console.log(program);

if (program.args.length !== 1) {
  program.help();
}

process.env.TRV_APP = program.args[0];
process.env.ENV = program.env;
process.env.PROFILE = [program.args, (process.env.PROFILE || '').split(/,/g), program.profile]
  .reduce((acc, v) => { acc.push(...v); return acc; })
  .map(x => x.trim())
  .filter(x => !!x)
  .join(',');

if (program.watch !== undefined) {
  if (program.watch) {
    process.env.WATCH = true;
  } else {
    process.env.NO_WATCH = true;
  }
}