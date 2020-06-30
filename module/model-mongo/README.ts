import { doc as d, lib, Mod, Code, inp, SnippetLink } from '@travetto/doc';
import { ModelSource } from '@travetto/model/src/service/source';
import { MongoModelConfig } from './src/config';

const ResourceManager = SnippetLink('ResourceManager', '@travetto/base/src/resource.ts', /class $Resource/);

export default d`
This module provides an ${lib.MongoDB}-based implementation of ${ModelSource} for the ${Mod('model')}.  This source allows the ${Mod('model')} module to read, write and query against ${lib.MongoDB}.. Given the dynamic nature of ${lib.MongoDB}, during development when models are modified, nothing needs to be done to adapt to the latest schema.

Out of the box, by installing the module, everything should be wired up by default.  If you need to customize any aspect of the source or config, you can override and register it with the ${Mod('di')} module.

${Code('Wiring up a custom Model Source', 'alt/docs/src/source.ts')}

where the ${MongoModelConfig} is defined by:

${Code('Structure of MongoModelConfig', MongoModelConfig.ᚕfile)}

and can be overridden via environment variables or config files, as defined in ${Mod('config')}.  The SSL file options in ${inp`clientOptions`} will automatically be resolved to files when given a path.  This path can be a ${ResourceManager} path or just a standard file path.

`;