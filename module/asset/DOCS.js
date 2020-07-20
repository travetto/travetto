const { doc: d, Install, Code, Section, SnippetLink, Snippet } = require('@travetto/doc');
const { Injectable } = require('@travetto/di');

const { AssetNamingStrategy, AssetService, AssetSource } = require('.');

const AssetLink = SnippetLink('Asset', './src/types.ts', /interface Asset/);

exports.text = d`

The asset module requires an ${AssetSource} to provide functionality for reading and writing files. You will need to select one of the available providers to serve as your ${AssetSource}.

${Install('provider', `@travetto/asset-{provider}`)}

Reading of and writing assets uses the ${AssetService}.  Below you can see an example dealing with a user's profile image.

${Code('User Profile Images', './alt/image/src/user-profile.ts')}

${Section('Naming Strategies')}

By default, the assets are stored by path, as specified in the ${AssetLink} object.  This is standard, and expected, but some finer control may be desired.  In addition to standard naming, the module also supports naming by hash, to prevent duplicate storage of the same files with different hashes. This is generally useful when surfacing a lot of public (within the application) user-generated content.

The underlying contract for a ${AssetNamingStrategy} looks like:

${Snippet('Asset Naming Strategy', './src/naming.ts', /class AssetNaming/, /^[}]/)}

By extending this, and making it ${Injectable}, the naming strategy will become the default for the system.  

${Section('Advanced Usage')}

In addition to reading and writing, you can also retrieve information on the saved asset, including basic information, and additional meta data.  The structure of the ${AssetLink} looks like:

${Code('Asset Structure', './src/types.ts')}

To get the asset information, you would call:

${Code('Fetching Asset Info', './alt/image/src/user-profile-tags.ts')}
`;