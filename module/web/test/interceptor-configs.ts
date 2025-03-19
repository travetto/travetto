import assert from 'node:assert';
import fs from 'node:fs';

import { castTo, Class } from '@travetto/runtime';
import { DependencyRegistry, Inject, Injectable } from '@travetto/di';
import { BeforeAll, Suite, Test } from '@travetto/test';
import { Config } from '@travetto/config';
import { RootRegistry } from '@travetto/registry';

import { ConfigureInterceptor } from '../src/decorator/common.ts';
import { Controller } from '../src/decorator/controller.ts';
import { Get } from '../src/decorator/endpoint.ts';
import { ManagedInterceptorConfig, HttpInterceptor } from '../src/interceptor/types.ts';
import { ControllerRegistry } from '../src/registry/controller.ts';
import { HttpResponse, FilterContext, WebServerHandle, WebInternal } from '../src/types.ts';
import { WebServer } from '../src/application/server.ts';
import { WebApplication } from '../src/application/app.ts';
import { CorsInterceptor } from '../src/interceptor/cors.ts';
import { GetCacheInterceptor } from '../src/interceptor/get-cache.ts';
import { EndpointConfig } from '../src/registry/types.ts';
import { HttpRequestCore } from '../src/request/core.ts';
import { HttpResponseCore } from '../src/response/core.ts';

@Injectable()
@Config('web.custom')
class CustomInterceptorConfig extends ManagedInterceptorConfig {
  name = 'bob';
  paths = ['!test-interceptor:blackListed'];

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

  @Inject()
  config: CustomInterceptorConfig;

  applies(endpoint: EndpointConfig) {
    return !/opt-in/.test(`${endpoint.path}`);
  }

  intercept(ctx: FilterContext<CustomInterceptorConfig>) {
    Object.assign(ctx.res, { name: ctx.config.name });
  }
}

@Controller('/test-interceptor')
@ConfigureInterceptor(CorsInterceptor, { disabled: true })
@ConfigureInterceptor(GetCacheInterceptor, { disabled: true })
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
@ConfigureInterceptor(CustomInterceptor, { disabled: true, name: 'greg' })
@ConfigureInterceptor(CorsInterceptor, { disabled: true })
@ConfigureInterceptor(GetCacheInterceptor, { disabled: true })
class AltTestController {
  @Get('/')
  async std() { }

  @Get('/opt-in')
  async none() { }

  @Get('/opt-in/for-real')
  @ConfigureInterceptor(CustomInterceptor, { disabled: false, name: 'sarah' })
  async optIn() { }

  @Get('/override')
  @ConfigureInterceptor(CustomInterceptor, { name: 'Randy' })
  async override() { }

  @Get('/blackListed')
  @ConfigureInterceptor(CustomInterceptor, {})
  async blackListed() { }
}

@Suite()
class TestInterceptorConfigSuite {
  async name<T>(cls: Class<T>, path: string): Promise<string | undefined> {
    const inst = await ControllerRegistry.get(cls);
    const endpoint = inst.endpoints.find(x => x.path === path)!;
    const res = HttpResponseCore.create<HttpResponse & { name?: string }>({
      [WebInternal]: {
        nodeEntity: castTo(fs.createWriteStream('/dev/null')),
        providerEntity: undefined!,
      },
      name: undefined,
      statusCode: 200,
      send: () => { },
      setHeader: (k, v) => { },
      getHeader: (k) => undefined,
      removeHeader: () => undefined,
    });
    await endpoint.handlerFinalized!(HttpRequestCore.create({
      [WebInternal]: {
        nodeEntity: castTo(Buffer.from([])),
        providerEntity: undefined!
      },
      headers: {}
    }), res);
    return res.name;
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
    assert(await this.name(TestController, '/opt-in') === undefined);
    assert(await this.name(AltTestController, '/opt-in') === undefined);
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
    assert(await this.name(TestController, '/blackListed') === undefined);
    assert(await this.name(AltTestController, '/blackListed') === 'greg');
  }
}