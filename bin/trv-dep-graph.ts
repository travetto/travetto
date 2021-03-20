import '@arcsine/nodesh';

const prep = (v: string) => v.replace('@travetto/', '');

const list = (name: string, obj: Record<string, string>, weight: number) =>
  Object.keys(obj ?? {}).filter(x => x.includes('@travetto')).map(x => [prep(name), prep(x), weight] as const);

[].$concat(
  ['digraph g {'],
  'module/*/package.json'
    .$dir()
    .$flatMap(p =>
      p.$read().$json().$flatMap(pkg => [
        ...list(pkg.name, pkg.dependencies, 10),
        // ...list(pkg.name, pkg.optionalPeerDependencies, 1),
      ])
    )
    .$map(([src, dest, weight]) => `"${src}" -> "${dest}" [ weight=${(src + dest).includes('-') ? weight / 2 : weight} ];`),
  ['}']
)
  .$stdout;