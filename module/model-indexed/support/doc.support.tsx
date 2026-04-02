/** @jsxImportSource @travetto/doc/support */
import { d, type DocJSXElementByFn, type DocJSXElement, DocFileUtil } from '@travetto/doc';
import { Runtime, toConcrete } from '@travetto/runtime';

import type { ModelIndexedSupport } from '../src/types/service.ts';

const toLink = (title: string, target: Function): DocJSXElementByFn<'CodeLink'> =>
  d.codeLink(title, Runtime.getSourceFile(target), new RegExp(`\\binterface\\s+${target.name}`));

export const Links = {
  Indexed: toLink('Indexed', toConcrete<ModelIndexedSupport>()),
};

export const ModelIndexedTypes = (fn: Function): DocJSXElement[] => {
  const { content } = DocFileUtil.readSource(fn);
  const found: DocJSXElementByFn<'CodeLink'>[] = [];
  const seen = new Set<string>();
  for (const [, key] of content.matchAll(/Model(Indexed)Support/g)) {
    if (!seen.has(key) && key in Links) {
      seen.add(key);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const link = Links[key as keyof typeof Links];
      found.push(link);
    }
  }
  return found.map(type => <li>{type}</li>);
};