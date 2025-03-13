import def from '@travetto/pack/support/rollup/build.ts';

export default function buildConfig(): ReturnType<typeof def> {
  const out = def();
  return out;
}