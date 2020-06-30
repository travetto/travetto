import { doc as d, Section, Code, inp, lib } from '@travetto/doc';
import { HttpRequest } from './src/request';

export default d`

${Section(`HTTP Requests`)}
The http request functionality exists to allow for simple usage of the ${inp`node`} ${lib.Http} and ${lib.Https} modules. ${HttpRequest} exists, in lieu of alternatives, as a means to provide the smallest footprint possible.  Using it is fairly straightforward:

${Code('Using HttpRequest', 'alt/docs/src/http-request.ts')}

Or a more complex example:

${Code('Using HttpRequest to Make API Calls', 'alt/docs/src/http-api-post.ts')}

`;

