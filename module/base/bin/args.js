const minimist = require('minimist');

function getArgs() {
  return minimist(process.argv.slice(2), {
    alias: {},
    string: ['env', 'profile'],
    boolean: ['watch'],
    alias: {
      profile: ['P']
    }
  });
}

function showHelp() {
  console.log(`Usage for ${process.argv[1]}: [--P <profile>] [--profile=profile] [--profile profile2] [--watch=<boolean>] [--env dev|test|e2e|prod] <application name>`);
}

const args = getArgs();

if (args._.length !== 1) {
  showHelp();
  process.exit(1);
} else {
  const app = args._[0];
  process.env.TRV_APP = app;
  const profiles = [app];

  if (process.env.PROFILE) {
    profiles.push(...process.env.PROFILE.split(/[, ]+/g));
  }

  for (const p of (args.profile || [])) {
    if (p.includes(',')) {
      profiles.push(...p.split(','));
    } else {
      profiles.push(p);
    }
  }

  if (profiles.length) {
    process.env.PROFILE = profiles.join(',');
  }

  if ('watch' in args) {
    if (args.watch) {
      process.env.WATCH = true;
    } else {
      process.env.NO_WATCH = true;
    }
  }
  if ('env' in args) {
    process.env.ENV = args.env;
  }
}