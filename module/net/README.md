# Network
## Network utilities of the travetto framework

**Install: @travetto/net**
```bash
npm install @travetto/net
```

## HTTP Requests
The http request functionality exists to allow for simple usage of the `node` [http](https://nodejs.org/api/http.html) and [https](https://nodejs.org/api/https.html) modules. [HttpRequest](https://github.com/travetto/travetto/tree/1.0.0-dev/module/net/src/request.ts#L13) exists, in lieu of alternatives, as a means to provide the smallest footprint possible.  Using it is fairly straightforward:

**Code: Using HttpRequest**
```typescript
import { HttpRequest } from '@travetto/net';

HttpRequest.exec({
  url: 'https://gooogle.com',
}).then(res => {
  console.log(res);
});
```

Or a more complex example:

**Code: Using HttpRequest to Make API Calls**
```typescript
import { HttpRequest } from '@travetto/net/src/request';

interface User {
  id: number;
  name: string;
}

HttpRequest.execJSON<User>({
  url: 'https://localhost:3000/api',
  method: 'post',
}, { id: 5, name: 'Test' }).then(res => {
  console.log(res.name);
});
```

