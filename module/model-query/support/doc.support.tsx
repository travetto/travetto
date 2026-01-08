/** @jsxImportSource @travetto/doc/support */
import { d, type DocJSXElementByFn, type DocJSXElement, DocFileUtil } from '@travetto/doc';
import { Runtime, toConcrete } from '@travetto/runtime';

import type { ModelQueryCrudSupport } from '../src/types/crud.ts';
import type { ModelQuerySupport } from '../src/types/query.ts';
import type { ModelQueryFacetSupport, } from '../src/types/facet.ts';
import type { ModelQuerySuggestSupport } from '../src/types/suggest.ts';

const toLink = (title: string, target: Function): DocJSXElementByFn<'CodeLink'> =>
  d.codeLink(title, Runtime.getSourceFile(target), new RegExp(`\\binterface\\s+${target.name}`));

export const Links = {
  QueryCrud: toLink('Query Crud', toConcrete<ModelQueryCrudSupport>()),
  QueryFacet: toLink('Facet', toConcrete<ModelQueryFacetSupport>()),
  QuerySuggest: toLink('Suggest', toConcrete<ModelQuerySuggestSupport>()),
  Query: toLink('Query', toConcrete<ModelQuerySupport>()),
};

export const ModelQueryTypes = (fn: Function): DocJSXElement[] => {
  const { content } = DocFileUtil.readSource(fn);
  const found: DocJSXElementByFn<'CodeLink'>[] = [];
  const seen = new Set<string>();
  for (const [, key] of content.matchAll(/Model(Query(Suggest|Facet|Crud)?)Support/g)) {
    if (!seen.has(key) && key in Links) {
      seen.add(key);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const link = Links[key as keyof typeof Links];
      found.push(link);
    }
  }
  return found.map(type => <li>{type}</li>);
};