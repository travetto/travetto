import { readFileSync } from 'fs';

import { d } from '@travetto/doc';
import { AllTypeMap } from '@travetto/doc/src/nodes';

export const Links = {
  QueryCrud: d.SnippetLink('Query Crud', '@travetto/model-query/src/service/crud', /export interface/),
  QueryFacet: d.SnippetLink('Facet', '@travetto/model-query/src/service/facet', /export interface/),
  QuerySuggest: d.SnippetLink('Suggest', '@travetto/model-query/src/service/suggest', /export interface/),
  Query: d.SnippetLink('Query', '@travetto/model-query/src/service/query', /export interface/),
};

export const ModelQueryTypes = (file: string | Function): AllTypeMap['SnippetLink'][] => {
  if (typeof file !== 'string') {
    file = file.Ⲑsource;
  }
  const contents = readFileSync(file, 'utf8');
  const found: AllTypeMap['SnippetLink'][] = [];
  const seen = new Set();
  for (const [, key] of contents.matchAll(/Model(Query(Suggest|Facet|Crud)?)Support/g)) {
    if (!seen.has(key)) {
      seen.add(key);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      found.push(Links[key as keyof typeof Links]);
    }
  }
  return found;
};