import type { Package } from '@travetto/manifest';
import { Schema } from '@travetto/schema';

export type PackageJsonShape = Partial<Pick<Package, 'name' | 'private' | 'type' | 'scripts' | 'devDependencies'>>;

@Schema()
export class PackageJsonSchema implements PackageJsonShape {
  name?: string;
  private?: boolean;
  type?: string;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
