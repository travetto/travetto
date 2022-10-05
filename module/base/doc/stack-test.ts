import { StacktraceManager } from '@travetto/base';

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

export function main() {
  process.on('unhandledRejection', (err: unknown) => {
    console.log(StacktraceManager.simplifyStack(err as Error));
  });

  test();
}