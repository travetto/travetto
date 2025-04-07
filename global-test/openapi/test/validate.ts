import assert from 'node:assert';

import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { Suite, Test } from '@travetto/test';
import { OpenApiService } from '@travetto/openapi';

@Suite()
export class OpenApiSuite {
  @Test()
  async verify() {
    await RootRegistry.init();
    const svc = await DependencyRegistry.getInstance(OpenApiService);

    const spec = await svc.getSpec();

    assert.deepStrictEqual(
      [...Object.keys(spec.paths ?? {})].toSorted(),
      [
        '/relationship/{name}',
        '/relationship',
        '/relationship/{id}',
        '/user/{name}',
        '/user/age/{age}',
        '/user',
        '/user/{id}'
      ].toSorted()
    );

    assert(spec.components?.schemas?.Paging);

    assert.deepStrictEqual(
      // @ts-expect-error
      spec.components!.schemas!.Paging['properties'],
      {
        start: { type: 'number', description: undefined },
        size: { type: 'number', description: undefined }
      }
    );
  }
}