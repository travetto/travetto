import { Client } from '@elastic/elasticsearch';

export function getVersion() {
  const c = new Client({ enableMetaHeader: true, nodes: [] });
  const prop = Object.getOwnPropertySymbols(c)
    .find(x => x.toString().includes('initial-options'))!;
  // @ts-expect-error
  const meta: string = c[prop];
  return Object.fromEntries(meta.split(',').map(x => x.split('=')))['es'];
}
