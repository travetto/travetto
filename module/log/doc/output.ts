process.env.TRV_DEBUG = '*'; // @doc-exclude
process.env.TRV_LOG_PLAIN = '0';  // @doc-exclude
import '@travetto/base';  // @doc-exclude

console.log('Hello World');

console.log('Woah!', { a: { b: { c: { d: 10 } } } });

console.info('Woah!');

console.debug('Test');