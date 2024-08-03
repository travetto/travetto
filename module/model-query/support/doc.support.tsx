/** @jsxImportSource @travetto/doc */
import { readFileSync } from 'node:fs';

import { d, DocJSXElementByFn, DocJSXElement } from '@travetto/doc';
import { Runtime } from '@travetto/runtime';

export const Links = {
  QueryCrud: d.codeLink('Query Crud', '@travetto/model-query/src/service/crud.ts', /export interface/),
  QueryFacet: d.codeLink('Facet', '@travetto/model-query/src/service/facet.ts', /export interface/),
  QuerySuggest: d.codeLink('Suggest', '@travetto/model-query/src/service/suggest.ts', /export interface/),
  Query: d.codeLink('Query', '@travetto/model-query/src/service/query.ts', /export interface/),
};

export const ModelQueryTypes = (fn: Function): DocJSXElement[] => {
  const contents = readFileSync(Runtime.getSourceFile(fn), 'utf8');
  const found: DocJSXElementByFn<'CodeLink'>[] = [];
  const seen = new Set();
  for (const [, key] of contents.matchAll(/Model(Query(Suggest|Facet|Crud)?)Support/g)) {
    if (!seen.has(key)) {
      seen.add(key);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      found.push(Links[key as keyof typeof Links]);
    }
  }
  return found.map(v => <li>{v}</li>);
};