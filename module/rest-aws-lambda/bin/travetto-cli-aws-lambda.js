module.exports = function init(program) {
  return program
    .command('aws-lambda [config]')
    .action((config, cmd) => {
      if (!config) {
        cmd.help();
      }
    });
};