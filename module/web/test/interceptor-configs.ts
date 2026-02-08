import assert from 'node:assert';

import { type Class, toConcrete } from '@travetto/runtime';
import { DependencyRegistryIndex, Inject, Injectable } from '@travetto/di';
import { BeforeAll, Suite, Test } from '@travetto/test';
import { Config } from '@travetto/config';
import { Registry } from '@travetto/registry';
import {
  ConfigureInterceptor, Controller, ControllerRegistryIndex, CorsInterceptor, Get,
  CacheControlInterceptor, type StandardWebRouter, type WebChainedContext, type WebInterceptor,
  type WebInterceptorCategory, type WebInterceptorContext, WebRequest
} from '@travetto/web';

@Injectable()
@Config('web.custom')
class CustomInterceptorConfig {
  applies: boolean = true;
  name = 'bob';

  weird() { }
}

@Injectable()
class CustomInterceptor implements WebInterceptor<CustomInterceptorConfig> {

  category: WebInterceptorCategory = 'global';

  @Inject()
  config: CustomInterceptorConfig;

  applies({ endpoint, config }: WebInterceptorContext<CustomInterceptorConfig>) {
    return config.applies || /opt-in/.test(`${endpoint.fullPath}`);
  }

  async filter({ config, next }: WebChainedContext<CustomInterceptorConfig>) {
    const out = await next();
    out.headers.set('Name', config.name);
    return out;
  }
}

@Controller('/test-interceptor')
@ConfigureInterceptor(CustomInterceptor, { applies: true })
@ConfigureInterceptor(CorsInterceptor, { applies: false })
@ConfigureInterceptor(CacheControlInterceptor, { applies: false })
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
@ConfigureInterceptor(CacheControlInterceptor, { applies: false })
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
    const inst = ControllerRegistryIndex.getConfig(cls);
    const endpoint = inst.endpoints.find(x => x.path === path)!;
    const response = await endpoint.filter!({ request: new WebRequest({}) });
    return response.headers.get('Name') ?? undefined;
  }

  @BeforeAll()
  async init() {
    await Registry.init();
    await DependencyRegistryIndex.getInstance(toConcrete<StandardWebRouter>());
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