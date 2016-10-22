var mocha = require('mocha');
var Suite = require('mocha/lib/suite');
var Test = require('mocha/lib/test');

export function registerContext(name, handler) {
  mocha.interfaces[name] = buildInterface();
}

function buildInterface() {
 return (suite) => {
  var suites = [suite];

  suite.on('pre-require', (context, file, mocha) => {
    var common = require('mocha/lib/interfaces/common')(suites, context);

    context.setup = common.beforeEach;
    context.teardown = common.afterEach;
    context.suiteSetup = common.before;
    context.suiteTeardown = common.after;

    context.describe = (title, fn) => {
      var suite = Suite.create(suites[0], title);
      suites.unshift(suite);
      fn();
      suites.shift();
    };

    context.it = (name, fn) => {
      var test = null;
      var cb = fn.toString().indexOf('(done)') >= 0;
      var gen = fn.toString().indexOf('yield ') >= 0;
      var op = null;

      if (gen) {
        op = (done) => {
          fn().then(done).catch(e => {
            console.log("Gen Error", e);
            done(e)
          });
        }
      } else {
        op = (done) => {
          try {
            fn(cb ? done : undefined);
            !cb && done();
          } catch (e) {
            done(e);
          }
        }
      }
      suites[0].addTest(new Test(name, function (done) {
        this.timeout(10000);
        done.timeout = this.timeout.bind(this);
        op(done);
      }));
    }
  });
};