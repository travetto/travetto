type SemverType = { major: number, minor: number, patch: number, prerelease?: [string, number] };
export type SemverLevel = keyof SemverType;

export class Semver {
  static parse(name: string): SemverType {
    const [ver, spec] = name.split('-');
    const [major, minor, patch] = ver.split(/[.]/);
    const pre = (spec ?? '').split(/[.]/);
    return { major: +major, minor: +minor, patch: +patch, prerelease: (pre ? [pre[0], +pre[1]] : undefined) };
  }

  static increment(ver: SemverType, level: SemverLevel, prefix?: string) {
    // Set
    switch (level) {
      case 'major': ver.minor = ver.patch = 0; break;
      case 'minor': ver.patch = 0; break;
    }
    // Increment
    switch (level) {
      case 'major':
      case 'minor':
      case 'patch': {
        ver[level] += 1;
        delete ver.prerelease;
        break;
      }
      case 'prerelease': {
        const computed = prefix ?? ver.prerelease?.[0] ?? 'alpha';
        ver.prerelease = [computed, ((computed === ver.prerelease?.[0] ? ver.prerelease?.[1] : undefined) ?? -1) + 1];
        break;
      }
    }
    return ver;
  }

  static format(ver: SemverType) {
    let main = `${ver.major}.${ver.minor}.${ver.patch}`;
    if (ver.prerelease) {
      main = `${main}-${ver.prerelease[0]}.${ver.prerelease[1]}`;
    }
    return main;
  }
}