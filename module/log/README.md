travetto: Log
===

**Install: primary**
```bash
$ npm install @travetto/log
```

This module provides logging functionality relying up the built in `console` operations. This is achieved via AST transformations. The code is rewritten at compile time to transform the `console` operations into proper logging commands. In addition to the transformation, class name and line number are added to the log messages to provide additional context.

The debug/trace content can be filtered using the patterns from the [`debug`](https://www.npmjs.com/package/debug).  You can specify wild cards to only `DEBUG` or `TRACE` specific modules, folders or files.  You can specify multiple, and you can also add negations to exclude specific packages. 

**Terminal: Sample environment flags**
```bash
# Debug
$ DEBUG=-@trv:registry npx travetto run app
$ DEBUG=@trv:rest npx travetto run app
$ DEBUG=@trv:*,-@trv:model npx travetto run app

# Trace
$ TRACE=-@trv:registry npx travetto run app
$ TRACE=@trv:rest npx travetto run app
$ TRACE=@trv:*,-@trv:model npx travetto run app

# BOTH
$ DEBUG=@trv:rest TRACE=-@trv:registry npx travetto run app
```

The supported operations are:
* `console.fatal` which logs at the `FATAL` level
* `console.error` which logs at the `ERROR` level
* `console.warn` which logs at the `WARN` level
* `console.info` which logs at the `INFO` level
* `console.debug` which logs at the `DEBUG` level
* `console.trace` which logs at the `TRACE` level
* `console.log` which logs at the `INFO` level

**Note:** In production mode, all `console.debug` and `console.trace` invocations are compiled away for performance/security reasons. This means that the code is actually removed, and will not execute.

A sample of the transformation would be:

**Code: Sample logging at various levels**
```typescript
function work() {
  console.trace('Start Work');
  ...
  try {
    ... bad invocation ...
  } catch (e) {
    console.error(e);
  }
  console.trace('End Work');
}
```
Which, when in *dev* mode transforms into:

**Code: Dev-time Transformation**
```typescript
function work() {
  Logger.log('trace', 'Start Work');
  try {
    ... bad invocation ...
  } catch (e) { 
    Logger.log('error', e);
  }
  Logger.log('trace', 'End Work');
}
```
And when in *prod* mode transforms into:

**Code: Prod-time Transformation**
```typescript
function work() {
  try {
    ... bad invocation ...
  } catch (e) { 
    Logger.log('error', e);
  }
}
```

The logging output, as indicated provides context for location of invocation. Given the file `test/simple.ts`:

**Code: Various log levels**
```typescript
console.log('Hello World');

console.log('Woah!', { a: { b: { c: { d: 10 } } } });

console.info('Woah!');

console.debug('Test');

console.fatal('hi');
```
The corresponding output would be

**Terminal: Logging output**
```bash
2018-06-23T16:57:58 info  [@test/simple:  5] Hello World
2018-06-23T16:57:58 info  [@test/simple:  7] Woah! { a: { b: { c: [Object] } } }
2018-06-23T16:57:58 info  [@test/simple:  9] Woah!
2018-06-23T16:57:58 debug [@test/simple: 11] Test
2018-06-23T16:57:58 fatal [@test/simple: 13] hi
```