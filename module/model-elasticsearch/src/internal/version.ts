import { PackageUtil } from '@travetto/manifest';

export function getVersion(): string {
  return PackageUtil.importPackage('@elastic/elasticsearch').version;
}
