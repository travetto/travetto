import { RuntimeIndex } from '@travetto/manifest';
import { TestClass } from './test-class';

export function main(): void {
  console.log(RuntimeIndex.getFunctionMetadata(TestClass));
}