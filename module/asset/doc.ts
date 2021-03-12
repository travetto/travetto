import { doc as d, Install, Code, Section, Snippet, SnippetLink, List, Header } from '@travetto/doc';
import { Injectable } from '@travetto/di';
import { FileModelService, MemoryModelService } from '@travetto/model';
import { MongoModelService } from '@travetto/model-mongo';
import { S3ModelService } from '@travetto/model-s3';
import { Links } from '@travetto/model/support/doc-support';

import { AssetService } from '.';

const Asset = SnippetLink('Asset', 'src/types.ts', /interface Asset/);
const AssetNamingStrategySnippet = Snippet('AssetNamingStrategy', 'src/naming.ts', /interface AssetNamingStrategy/, /^[}]/);

export const text = d`
${Header()}

The asset module requires an ${Links.Stream} to provide functionality for reading and writing streams. You can use any existing providers to serve as your ${Links.Stream}, or you can roll your own.

${Install('provider', `@travetto/model-{provider}`)}

Currently, the following are packages that provide ${Links.Stream}:
${List(
  d`@travetto/model - ${FileModelService}, ${MemoryModelService}`,
  d`@travetto/model-mongo - ${MongoModelService}`,
  d`@travetto/model-s3 - ${S3ModelService}`,
)}

If you are using more than one ${Links.Stream}-based service, you will need to declare which one is intended to be used by the asset service.  This can be accomplished by:

${Code('Configuration Methods', 'doc/asset-config.ts')}

Reading of and writing assets uses the ${AssetService}.  Below you can see an example dealing with a user's profile image.

${Code('User Profile Images', 'doc/user-profile.ts')}

${Section('Naming Strategies')}

By default, the assets are stored by path, as specified in the ${Asset} object.  This is standard, and expected, but some finer control may be desired.  In addition to standard naming, the module also supports naming by hash, to prevent duplicate storage of the same files with different hashes. This is generally useful when surfacing a lot of public (within the application) user-generated content.

The underlying contract for a ${AssetNamingStrategySnippet.link} looks like:

${AssetNamingStrategySnippet}

By extending this, and making it ${Injectable}, the naming strategy will become the default for the system.  

${Section('Advanced Usage')}

In addition to reading and writing, you can also retrieve information on the saved asset, including basic information, and additional meta data.  The structure of the ${Asset} looks like:

${Code('Asset Structure', 'src/types.ts')}

To get the asset information, you would call:

${Code('Fetching Asset Info', 'doc/user-profile-meta.ts')}
`;