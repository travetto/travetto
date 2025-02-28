/** @jsxImportSource @travetto/doc */
import { d, DocJSXElementByFn, DocJSXElement, DocFileUtil } from '@travetto/doc';

export const Links = {
  QueryCrud: d.codeLink('Query Crud', '@travetto/model-query/src/types/crud.ts', /export interface/),
  QueryFacet: d.codeLink('Facet', '@travetto/model-query/src/types/facet.ts', /export interface/),
  QuerySuggest: d.codeLink('Suggest', '@travetto/model-query/src/types/suggest.ts', /export interface/),
  Query: d.codeLink('Query', '@travetto/model-query/src/types/query.ts', /export interface/),
};

export const ModelQueryTypes = (fn: Function): DocJSXElement[] => {
  const { content } = DocFileUtil.readSource(fn);
  const found: DocJSXElementByFn<'CodeLink'>[] = [];
  const seen = new Set();
  for (const [, key] of content.matchAll(/Model(Query(Suggest|Facet|Crud)?)Support/g)) {
    if (!seen.has(key)) {
      seen.add(key);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      found.push(Links[key as keyof typeof Links]);
    }
  }
  return found.map(v => <li>{v}</li>);
};