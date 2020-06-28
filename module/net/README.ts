import { d, Section, Library, Code, inp } from '@travetto/doc';
import { HttpRequest } from './src/request';

export default d`

${Section(`HTTP Requests`)}
The http request functionality exists to allow for simple usage of the ${inp`node`} ${Library(`http`, 'https://nodejs.org/api/http.html')} and ${Library('https', 'https://nodejs.org/api/http.html')} modules. ${HttpRequest} exists, in lieu of alternatives, as a means to provide the smallest footprint possible.  Using it is fairly straightforward:

${Code('Using HttpRequest', 'alt/docs/src/http-request.ts')}

Or a more complex example:

${Code('Using HttpRequest to Make API Calls', 'alt/docs/src/http-api-post.ts')}

`;

