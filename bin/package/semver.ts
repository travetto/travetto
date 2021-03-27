type Semversion = { major: number, minor: number, patch: number, prerelease?: [string, number] };
export type SemverLevel = keyof Semversion;

export class Semver {
  static parse(name: string): Semversion {
    const [ver, spec] = name.split('-');
    const [major, minor, patch] = ver.split(/[.]/);
    const pre = (spec ?? '').split(/[.]/);
    return { major: +major, minor: +minor, patch: +patch, prerelease: (pre ? [pre[0], +pre[1]] : undefined) };
  }

  static increment(ver: Semversion, level: SemverLevel, prefix?: string) {
    switch (level) {
      case 'major': ver.minor = 0;
      // eslint-disable-next-line no-fallthrough
      case 'minor': ver.patch = 0;
      // eslint-disable-next-line no-fallthrough
      case 'patch': {
        ver[level] += 1;
        delete ver.prerelease;
        break;
      }
      case 'prerelease': {
        ver.prerelease = [ver.prerelease?.[0] ?? prefix!, (ver.prerelease?.[1] ?? -1) + 1];
        break;
      }
    }
    return ver;
  }

  static format(ver: Semversion) {
    let main = `${ver.major}.${ver.minor}.${ver.patch}`;
    if (ver.prerelease) {
      main = `${main}-${ver.prerelease[0]}.${ver.prerelease[1]}`;
    }
    return main;
  }
}