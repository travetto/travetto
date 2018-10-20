travetto: JWT
===

This module is a simple component to support [`JWT`](https://jwt.io/) signing and verification.  The framework provides a port of [`node-jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken). The API has been streamlined, and is intended as a lower level component as a basis for other modules.

The API exposes:

```typescript
sign(payload:object, config:{
  key?: string | Buffer | Promise<string | Buffer>;  // Signing Key
  iatExclude?: boolean; // Do not return or set the issuedAt flag
  alg?: string; // Which  encoding algorithm
  header?: { [key: string]: string }; // Any additional header information
  encoding?: string; // Encoding, defaults to utf8
}):Promise<string>;
```

```typescript
decode(token: string): Payload;

decodeComplete(token:string): {
  header: {},
  signature: string,
  payload: Payload
}
```

```typescript
verify(token: string, options: {
  clock?: { 
    timestamp?: number | Date, // Timestamp as basis for expiry checks
    tolerance?: number  // How many seconds are you willing to tolerate
  },
  ignore?: { 
    exp?: boolean,  // Ignore expires
    nbf?: boolean   // Ignore not before
  },
  maxAgeSec?: number, // Maximum age of token in seconds
  header?: { [key: string]: string }, // Match against specific header fields
  key?: string | Buffer | Promise<string | Buffer>, // Use the key for decoding token
  encoding?: string, // Defaults to utf8
  alg?: string | string[]; // Algorithm for decryption
  payload?: {
    aud?: string | RegExp | (string | RegExp)[]; // Match the payload aud against a set of audiences
    ... // Match against any payload value
  } 
}):Promise<string>
```
