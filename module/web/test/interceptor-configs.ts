import assert from 'node:assert';
import { Readable } from 'node:stream';

import { Class } from '@travetto/runtime';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { BeforeAll, Suite, Test } from '@travetto/test';
import { Config } from '@travetto/config';
import { RootRegistry } from '@travetto/registry';

import { ConfigureInterceptor } from '../src/decorator/common.ts';
import { Controller } from '../src/decorator/controller.ts';
import { Get } from '../src/decorator/endpoint.ts';
import { HttpInterceptor, HttpInterceptorCategory } from '../src/types/interceptor.ts';
import { ControllerRegistry } from '../src/registry/controller.ts';
import { HttpChainedContext } from '../src/types.ts';
import { WebServer, WebServerHandle } from '../src/types/server.ts';
import { WebApplication } from '../src/application/app.ts';
import { CorsInterceptor } from '../src/interceptor/cors.ts';
import { GetCacheInterceptor } from '../src/interceptor/get-cache.ts';
import { EndpointConfig } from '../src/registry/types.ts';
import { HttpRequest } from '../src/types/request.ts';

@Injectable()
@Config('web.custom')
class CustomInterceptorConfig {
  applies: boolean = true;
  name = 'bob';

  weird() { }
}

@Injectable()
class Server implements WebServer {
  listening: boolean;
  async init(): Promise<void> { }
  async registerEndpoints(key: string | symbol, path: string, endpoints: EndpointConfig[], interceptors?: HttpInterceptor<unknown>[] | undefined): Promise<void> { }
  async unregisterEndpoints(key: string | symbol): Promise<void> { }
  listen(): WebServerHandle | Promise<WebServerHandle> {
    return {
      close(cb?: Function) { },
      on(type: 'close', cb: Function) { }
    };
  }
}

@Injectable()
class CustomInterceptor implements HttpInterceptor<CustomInterceptorConfig> {

  category: HttpInterceptorCategory = 'global';

  @Inject()
  config: CustomInterceptorConfig;

  applies(endpoint: EndpointConfig, config: CustomInterceptorConfig) {
    return config.applies || /opt-in/.test(`${endpoint.fullPath}`);
  }

  filter({ req, config, next }: HttpChainedContext<CustomInterceptorConfig>) {
    Object.assign(req, { name: config.name });
    return next();
  }
}

@Controller('/test-interceptor')
@ConfigureInterceptor(CustomInterceptor, { applies: true })
@ConfigureInterceptor(CorsInterceptor, { applies: false })
@ConfigureInterceptor(GetCacheInterceptor, { applies: false })
class TestController {
  @Get('/')
  async std() { }

  @Get('/opt-in')
  async none() { }

  @Get('/opt-in/for-real')
  @ConfigureInterceptor(CustomInterceptor, {})
  async optIn() { }

  @Get('/override')
  @ConfigureInterceptor(CustomInterceptor, { name: 'jane' })
  async override() { }

  @Get('/blackListed')
  async blackListed() { }
}

@Controller('/alt-test-interceptor')
@ConfigureInterceptor(CustomInterceptor, { applies: false, name: 'greg' })
@ConfigureInterceptor(CorsInterceptor, { applies: false })
@ConfigureInterceptor(GetCacheInterceptor, { applies: false })
class AltTestController {
  @Get('/')
  async std() { }

  @Get('/opt-in')
  async none() { }

  @Get('/opt-in/for-real')
  @ConfigureInterceptor(CustomInterceptor, { name: 'sarah' })
  async optIn() { }

  @Get('/override')
  @ConfigureInterceptor(CustomInterceptor, { applies: true, name: 'Randy' })
  async override() { }

  @Get('/blackListed')
  @ConfigureInterceptor(CustomInterceptor, { applies: true })
  async blackListed() { }
}

@Suite()
class TestInterceptorConfigSuite {
  async name<T>(cls: Class<T>, path: string): Promise<string | undefined> {
    const inst = await ControllerRegistry.get(cls);
    const endpoint = inst.endpoints.find(x => x.path === path)!;
    const req: HttpRequest & { name?: string } = new HttpRequest({
      inputStream: Readable.from(Buffer.from([])),
      respond: () => { },
      headers: {},
      method: 'GET',
      params: {},
      query: {},
      path: '',
      port: 0,
      protocol: 'http',
    });
    await endpoint.filter!({ req });
    return req.name;
  }

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    await DependencyRegistry.getInstance(WebApplication);
  }

  @Test()
  async verifyBasic() {
    assert(await this.name(TestController, '/') === 'bob');
    assert(await this.name(AltTestController, '/') === undefined);
    assert(await this.name(TestController, '/opt-in') === 'bob');
    assert(await this.name(AltTestController, '/opt-in') === 'greg');
  }

  @Test()
  async verifyOptIn() {
    assert(await this.name(TestController, '/opt-in/for-real') === 'bob');
    assert(await this.name(AltTestController, '/opt-in/for-real') === 'sarah');
  }

  @Test()
  async verifyOverride() {
    assert(await this.name(TestController, '/override') === 'jane');
    assert(await this.name(AltTestController, '/override') === 'Randy');
  }

  @Test()
  async verifyBlacklist() {
    assert(await this.name(TestController, '/blackListed') === 'bob');
    assert(await this.name(AltTestController, '/blackListed') === 'greg');
  }
}