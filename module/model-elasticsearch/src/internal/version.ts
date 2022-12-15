import { PackageUtil } from '@travetto/manifest';

export function getVersion(): string {
  return PackageUtil.readPackage(PackageUtil.resolvePackagePath('@elastic/elasticsearch')).version;
}
