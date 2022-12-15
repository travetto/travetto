import { readFileSync } from 'fs';

import { RootIndex } from '@travetto/manifest';
import { d, mod } from '@travetto/doc';
import { Config } from '@travetto/config';
import { AllType, AllTypeMap } from '@travetto/doc/src/nodes';

export const Links = {
  Basic: d.SnippetLink('Basic', '@travetto/model/src/service/basic.ts', /export interface/),
  Crud: d.SnippetLink('CRUD', '@travetto/model/src/service/crud.ts', /export interface/),
  Expiry: d.SnippetLink('Expiry', '@travetto/model/src/service/expiry.ts', /export interface/),
  Indexed: d.SnippetLink('Indexed', '@travetto/model/src/service/indexed.ts', /export interface/),
  Bulk: d.SnippetLink('Bulk', '@travetto/model/src/service/bulk.ts', /export interface/),
  Stream: d.SnippetLink('Streaming', '@travetto/model/src/service/stream.ts', /export interface/),
};

export const ModelTypes = (file: string | Function): AllTypeMap['SnippetLink'][] => {
  if (typeof file !== 'string') {
    file = RootIndex.getFunctionMetadata(file)!.source;
  }
  const contents = readFileSync(file, 'utf8');
  const found: AllTypeMap['SnippetLink'][] = [];
  const seen = new Set();
  for (const [, key] of contents.matchAll(/Model(Crud|Expiry|Indexed|Bulk|Stream)Support/g)) {
    if (!seen.has(key)) {
      seen.add(key);
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      found.push(Links[key as keyof typeof Links]);
    }
  }
  return found;
};

export const ModelCustomConfig = (cfg: Function): AllType => d`
    Out of the box, by installing the module, everything should be wired up by default.If you need to customize any aspect of the source 
    or config, you can override and register it with the ${mod.Di} module.

    ${d.Code('Wiring up a custom Model Source', 'doc/custom-service.ts')}

  where the ${cfg} is defined by:

  ${d.Code(`Structure of ${cfg.name}`, cfg)}

  Additionally, you can see that the class is registered with the ${Config} annotation, and so these values can be overridden using the 
  standard ${mod.Config}resolution paths. 
  `;