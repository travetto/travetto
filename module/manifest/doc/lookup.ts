import { Runtime } from '@travetto/base';
import { TestClass } from './test-class';

export function main(): void {
  console.log(Runtime.describeFunction(TestClass));
}