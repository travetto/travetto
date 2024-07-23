import { MetadataIndex } from '@travetto/manifest';
import { TestClass } from './test-class';

export function main(): void {
  console.log(MetadataIndex.get(TestClass));
}