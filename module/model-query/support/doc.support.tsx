/** @jsxImportSource @travetto/doc */
import { readFileSync } from 'node:fs';

import { d, DocJSXElementByFn, DocJSXElement } from '@travetto/doc';
import { RuntimeContext } from '@travetto/base';

export const Links = {
  QueryCrud: d.codeLink('Query Crud', '@travetto/model-query/src/service/crud.ts', /export interface/),
  QueryFacet: d.codeLink('Facet', '@travetto/model-query/src/service/facet.ts', /export interface/),
  QuerySuggest: d.codeLink('Suggest', '@travetto/model-query/src/service/suggest.ts', /export interface/),
  Query: d.codeLink('Query', '@travetto/model-query/src/service/query.ts', /export interface/),
};

export const ModelQueryTypes = (file: string | Function): DocJSXElement[] => {
  if (typeof file !== 'string') {
    file = RuntimeContext.getFunctionMetadata(file)!.source;
  }
  const contents = readFileSync(file, 'utf8');
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