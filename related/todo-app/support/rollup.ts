import def from '@travetto/pack/support/bin/rollup';

export default function buildConfig(): ReturnType<typeof def> {
  const out = def();
  return out;
}