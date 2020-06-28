import { d, Code, Library, List, Note } from '@travetto/doc';
import { PassportIdentitySource } from './src/identity';

const Passport = Library('passport', 'http://passportjs.org');

export default d`
Within the node ecosystem, the most prevalent auth framework is ${Passport}.  With countless integrations, the desire to leverage as much of it as possible, is extremely high. To that end, this module provides support for ${Passport} baked in. Registering and configuring a ${Passport} strategy is fairly straightforward.

${Code('Sample Facebook/passport config', 'alt/e2e/src/conf.ts')}

As you can see, ${PassportIdentitySource} will take care of the majority of the work, and all that is required is:
${List(
  `Provide the name of the strategy (should be unique)`,
  d`Provide the strategy instance. ${Note('you will need to provide the callback for the strategy to ensure you pass the external principal back into the framework')}`,
  `The conversion functions which defines the mapping between external and local identities.`
)}

After that, the provider is no different than any other, and can be used accordingly.  Additionally, because ${Passport} runs first, in it's entirety, you can 
use the provider as you normally would any ${Passport} middleware.

${Code('Sample routes using Facebook/passport provider', 'alt/e2e/src/simple.ts')}
`;