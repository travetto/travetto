import { StacktraceUtil } from '@travetto/base';

function inner3() {
  throw new Error('Uh oh');
}

async function inner2() {
  return await inner3();
}

async function inner1() {
  return await inner2();
}

async function test() {
  await inner1();
}

process.on('unhandledRejection', (err: any) => {
  StacktraceUtil.init();
  console!.log(StacktraceUtil.simplifyStack(err));
});

test();