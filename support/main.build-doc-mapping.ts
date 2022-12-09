import { RootIndex, PackageUtil } from '@travetto/manifest';

type DocModMapping = { simpleName: string, name: string, displayName: string, folder: string, description?: string };

export async function main(): Promise<void> {
  const out: DocModMapping[] = [];
  for (const module of Object.values(RootIndex.manifest.modules)) {
    const pkg = PackageUtil.readPackage(module.source);
    if (!pkg.name.startsWith('@travetto') || !pkg.travetto || !pkg.travetto.displayName) {
      continue;
    }

    const simpleName = pkg.name
      .split('/')[1]
      .replace(/^[a-z]/, x => x.toUpperCase())
      .replace(/([a-z])-([a-z])/g, (_, l, r) => `${l}${r.toUpperCase()}`);
    out.push({
      simpleName,
      name: module.name,
      displayName: pkg.travetto.displayName,
      folder: module.source.split(`${RootIndex.manifest.workspacePath}/`)[1],
      description: pkg.description
    });
  }
  const text: string[] = [];

  for (const mod of out.sort((a, b) => a.name.localeCompare(b.name))) {
    text.push(`
  ${mod.simpleName}: {
    name:'${mod.name}', folder:'${mod.folder}', displayName: '${mod.displayName}',
    description: '${mod.description?.replaceAll("'", '\\\'')}'
  }`);
  }

  process.stdout.write(`{\n${text.join(',')}\n}\n`);
}