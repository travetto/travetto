import def from '@travetto/pack/support/rollup/build';

export default function buildConfig(): ReturnType<typeof def> {
  const out = def();
  return out;
}