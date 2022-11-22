export const DEP_GROUPS = [
  'dependencies', 'devDependencies',
  'peerDependencies', 'optionalDependencies',
] as const;

export type DepGroup = (typeof DEP_GROUPS[number]);

export type SemverLevel = 'minor' | 'patch' | 'major' | 'prerelease';