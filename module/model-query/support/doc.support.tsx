/** @jsxImportSource @travetto/doc */
import { d, DocJSXElementByFn, DocJSXElement, DocFileUtil } from '@travetto/doc';
import { Runtime, toConcrete } from '@travetto/runtime';
import { ModelQueryCrudSupport, ModelQueryFacetSupport, ModelQuerySuggestSupport, ModelQuerySupport } from '../__index__';

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
  return found.map(v => <li>{v}</li>);
};