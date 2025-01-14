<!-- This file was generated by @travetto/doc and should not be modified directly -->
<!-- Please modify https://github.com/travetto/travetto/tree/main/module/rest-session/DOC.tsx and execute "npx trv doc" to rebuild -->
# REST Session

## Session provider for the travetto rest module.

**Install: @travetto/rest-session**
```bash
npm install @travetto/rest-session

# or

yarn add @travetto/rest-session
```

This is a module that adds session support to the [RESTful API](https://github.com/travetto/travetto/tree/main/module/rest#readme "Declarative api for RESTful APIs with support for the dependency injection module.") framework.  Sessions allow for persistent data across multiple requests.  Within the framework the sessions are stored against any [Data Modeling Support](https://github.com/travetto/travetto/tree/main/module/model#readme "Datastore abstraction for core operations.") implementation that provides [ModelExpirySupport](https://github.com/travetto/travetto/tree/main/module/model/src/service/expiry.ts), as the data needs to be able to be expired appropriately.  The list of supported model providers are:
   *  [Redis Model Support](https://github.com/travetto/travetto/tree/main/module/model-redis#readme "Redis backing for the travetto model module.")
   *  [MongoDB Model Support](https://github.com/travetto/travetto/tree/main/module/model-mongo#readme "Mongo backing for the travetto model module.")
   *  [S3 Model Support](https://github.com/travetto/travetto/tree/main/module/model-s3#readme "S3 backing for the travetto model module.")
   *  [DynamoDB Model Support](https://github.com/travetto/travetto/tree/main/module/model-dynamodb#readme "DynamoDB backing for the travetto model module.")
   *  [Elasticsearch Model Source](https://github.com/travetto/travetto/tree/main/module/model-elasticsearch#readme "Elasticsearch backing for the travetto model module, with real-time modeling support for Elasticsearch mappings.")
   *  [File Model Support](https://github.com/travetto/travetto/tree/main/module/model-file#readme "File system backing for the travetto model module.")
   *  [Memory Model Support](https://github.com/travetto/travetto/tree/main/module/model-memory#readme "Memory backing for the travetto model module.")
A session allows for defining the expiration time, what state the session should be in, as well as the payload (session data).  The session and session data are accessible via the [@Context](https://github.com/travetto/travetto/tree/main/module/rest/src/decorator/param.ts#L38) parameter as [Session](https://github.com/travetto/travetto/tree/main/module/rest-session/src/session.ts#L15) and [SessionData](https://github.com/travetto/travetto/tree/main/module/rest-session/src/session.ts#L8) respectively.  Iit can also be accessed via the [Request](https://github.com/travetto/travetto/tree/main/module/rest-session/src/trv.d.ts#L8) as a session property.

**Code: Sample Session Usage**
```typescript
import { InjectableFactory } from '@travetto/di';
import { ModelExpirySupport } from '@travetto/model';
import { Controller, Put, Get } from '@travetto/rest';
import { SessionData, Session, SessionModelSymbol } from '@travetto/rest-session';
import { MemoryModelService } from '@travetto/model-memory';

// Applies to entire execution, not just this file
class SessionConfig {
  /**
   * Session provider must be specified. The memory service is sufficient for simple
   *   workloads, buts falls down when dealing with multiple servers
   */
  @InjectableFactory(SessionModelSymbol)
  static getSessionModel(memory: MemoryModelService): ModelExpirySupport {
    return memory;
  }
}

@Controller('/session')
export class SessionRoutes {

  @Put('/info')
  async storeInfo(data: SessionData) {
    data.age = 20;
    data.name = 'Roger'; // Setting data
  }

  @Get('/logout')
  async logout(session: Session) {
    await session.destroy();
  }

  @Get('/info/age')
  async getInfo(data: SessionData) {
    return data.age;
  }
}
```

This usage should be comparable to [express](https://expressjs.com), [koa](https://koajs.com/) and mostly every other framework.

## Session Configuration
The module supports a general set of configuration that should cover the majority of session behaviors:

**Code: Session Config**
```typescript
import { AppError, Runtime, TimeUtil } from '@travetto/runtime';
import { Config } from '@travetto/config';
import { Secret } from '@travetto/schema';

/**
 * Rest session config
 */
@Config('rest.session')
export class SessionConfig {
  /**
   * Should the session auto write
   */
  autoCommit = true;
  /**
   * Max age for a given session
   */
  maxAge = TimeUtil.asMillis(30, 'm'); // Half hour
  /**
   * Can the session be renewed
   */
  renew = true;
  /**
   * Should the session support rolling renewals
   */
  rolling = false;
  /**
   * Should the session be signed
   */
  sign = true;
  /**
   * Secret for signing the session
   */
  @Secret()
  secret?: string;
  /**
   * Signature key name
   */
  keyName = 'trv_sid';
  /**
   * Location for auth
   */
  transport: 'cookie' | 'header' = 'cookie';

  postConstruct(): void {
    if (!this.secret && Runtime.production) {
      throw new AppError('Default session secret is only valid for development use, please specify a config value at rest.session.secret');
    }
  }
}
```

These are all configurable via the `rest.session.*` config values.  And as a note, in production, a secret is required to be specified.
