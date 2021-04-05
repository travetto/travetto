import * as fs from 'fs';

import { d, mod } from '@travetto/doc';
import { Config } from '@travetto/config';
import { AllTypeMap } from '@travetto/doc/src/nodes';

export const Links = {
  Basic: d.SnippetLink('Basic', '@travetto/model/src/service/basic', /export interface/),
  Crud: d.SnippetLink('CRUD', '@travetto/model/src/service/crud', /export interface/),
  Expiry: d.SnippetLink('Expiry', '@travetto/model/src/service/expiry', /export interface/),
  Indexed: d.SnippetLink('Indexed', '@travetto/model/src/service/indexed', /export interface/),
  Bulk: d.SnippetLink('Bulk', '@travetto/model/src/service/bulk', /export interface/),
  Stream: d.SnippetLink('Streaming', '@travetto/model/src/service/stream', /export interface/),
};

export const ModelTypes = (file: string | { ᚕfile: string }) => {
  if (typeof file !== 'string') {
    file = file.ᚕfile;
  }
  const contents = fs.readFileSync(file, 'utf8');
  const found: AllTypeMap['SnippetLink'][] = [];
  const seen = new Set();
  for (const [, key] of contents.matchAll(/Model(Crud|Expiry|Indexed|Bulk|Stream)Support/g)) {
    if (!seen.has(key)) {
      seen.add(key);
      found.push(Links[key as keyof typeof Links]);
    }
  }
  return found;
};

export const ModelCustomConfig = (cfg: { name: string, ᚕfile: string }) =>
  d`
    Out of the box, by installing the module, everything should be wired up by default.If you need to customize any aspect of the source 
    or config, you can override and register it with the ${mod.Di} module.

    ${d.Code('Wiring up a custom Model Source', 'doc/custom-service.ts')}

  where the ${cfg} is defined by:

  ${d.Code(`Structure of ${cfg.name}`, cfg.ᚕfile)}

  Additionally, you can see that the class is registered with the ${Config} annotation, and so these values can be overridden using the 
  standard ${mod.Config}resolution paths. 
  `;