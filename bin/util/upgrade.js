#!/usr/bin/env -S npx @arcsine/nodesh
/// @ts-check
/// <reference types="/tmp/npx-scripts/arcsine.nodesh" lib="npx-scripts" />

$exec('npx', ['lerna', 'ls', '-p', '-a'])
  .$notEmpty()
  .$filter(x => x.includes(process.cwd()))
  .$concat([process.cwd()])
  .$parallel(m =>
    `${m}/package.json`
      .$read({ singleValue: true })
      .$json()
      .$flatMap(pkg =>
        [
          'dependencies', 'devDependencies',
          'peerDependencies', 'optionalDependencies',
          'optionalPeerDependencies'
        ]
          .$flatMap(type =>
            Object.entries(pkg[type] || {})
              .$map(([dep, version]) => ({ dep, type, version }))
          )
          .$filter(x => /^[\^~<>]/.test(x.version)) // Rangeable
          .$filter(x => !x.dep.startsWith('@travetto'))
          .$parallel(({ dep, type, version }) =>
            $exec(`npm`, {
              args: ['show', `${dep}@${version}`, 'version', '--json'],
              spawn: { cwd: m }
            })
              .$json()
              .$map(v => {
                const top = Array.isArray(v) ? v.pop() : v;
                const curr = pkg[type][dep];
                const next = version.replace(/\d.*$/, top);
                if (next !== curr) {
                  pkg[type][dep] = next;
                  return `${dep}@(${curr} -> ${next})`;
                }
              })
              .$onError(x => [])
          )
          .$notEmpty()
          .$collect()
          .$map(async (all) => {
            if (all.length > 0) {
              await JSON.stringify(pkg, undefined, 2).$write(`${m}/package.json`);
            }
            return `.${m.split(process.cwd())[1].padEnd(30)} updated ${all.length} dependencies - ${all.join(', ') || 'None'}`;
          })
      )
  )
  .$console;