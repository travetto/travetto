import '@arcsine/nodesh';

function combine(a: string[], ...b: string[]) {
  return [...new Set([...(a || []), ...(b || [])])];
}

function enhancePackage(file: string, {
  name, displayName, version, description,
  files, main, bin, scripts, keywords,
  dependencies, devDependencies, peerDependencies,
  optionalDependencies, optionalPeerDependencies,
  engines, private: priv, repository, author,
  publishConfig, ...rest
}: Record<string, any>) {
  return {
    name,
    displayName,
    version,
    description,
    keywords: combine(keywords, 'travetto', 'typescript'),
    homepage: 'https://travetto.io',
    license: 'MIT',
    author: {
      email: 'travetto.framework@gmail.com',
      name: 'Travetto Framework'
    },
    files,
    main,
    bin,
    repository: {
      url: 'https://github.com/travetto/travetto.git',
      directory: file.replace(`${process.cwd()}/`, '').replace(/\/package.json/, '')
    },
    scripts,
    dependencies,
    devDependencies,
    peerDependencies,
    optionalDependencies,
    optionalPeerDependencies,
    engines,
    private: priv,
    publishConfig: {
      access: priv ? 'restricted' : 'public'
    },
    ...rest
  };
}

'{module,related}/*/package.json'
  .$dir()
  .$forEach(a => a.$read()
    .$json()
    .$map(v => enhancePackage(a, v))
    .$map(v => JSON.stringify(v, null, 2))
    .$writeFinal(a)
  );