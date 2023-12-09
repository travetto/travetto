import { RootIndex } from '@travetto/manifest';
import { TestClass } from './test-class';

export function main(): void {
  console.log(RootIndex.getFunctionMetadata(TestClass));
}