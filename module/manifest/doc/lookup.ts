import { RuntimeContext } from '@travetto/base';
import { TestClass } from './test-class';

export function main(): void {
  console.log(RuntimeContext.getFunctionMetadata(TestClass));
}