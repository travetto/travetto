import assert from 'node:assert';

import { Registry } from '@travetto/registry';
import { IsPrivate } from '@travetto/schema';
import { Controller, ControllerVisitUtil, Delete, Get, Head, Patch, Post, Put, QueryParam } from '@travetto/web';
import { BeforeAll, Suite, Test } from '@travetto/test';
import { OpenapiVisitor } from '@travetto/openapi';
import { BinaryUtil } from '@travetto/runtime';

import { TestUser } from './model.ts';

interface UserSearch {
  name?: string;
  age?: number;
}

@Controller('/test')
class TestCont {
  @Get('/user')
  async getUser(name: string) {
    return new TestUser();
  }
  @Get('/users')
  async getUsers(name: string) {
    return [new TestUser()];
  }

  @Get('/user-search')
  async search(search: UserSearch) {
    return [new TestUser()];
  }

  @Post('/user-search')
  async postSearch(search: UserSearch) {
    return [new TestUser()];
  }

  @Get('/user-search-prefix')
  async searchPrefix(@QueryParam({ prefix: 'search' }) search: UserSearch) {
    return [new TestUser()];
  }

  @Put('/names')
  async updateNames(names: string[]) {
    return names;
  }

  @Patch('/who')
  async updateWho(who?: { name: string, color: string }) {
    return [who?.color];
  }

  @Delete('/:id')
  async remove(id: string) {
  }

  @Delete('/all/:id')
  async removeAll(id: string, match: TestUser) {
  }

  @Head('/all/:id')
  async headAll(id: string, match?: TestUser) {
  }

  @Get('/download')
  async download(size?: number) {
    return BinaryUtil.toBinaryStream(BinaryUtil.makeBinaryArray(0));
  }

  @IsPrivate()
  @Delete('/random')
  async ignore(): Promise<void> {

  }
}

@IsPrivate()
@Controller('/test2')
class IgnoredCont {
  @Get('/user')
  async getUser(name: string) {
    return new TestUser();
  }
}

@Suite()
class GenerateSuite {

  @BeforeAll()
  async init() {
    await Registry.init();
  }

  @Test()
  async verifyGeneral() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(config);
    assert(Object.keys(config.paths).length === 9);
    assert(Object.keys(config.components.schemas).length >= 2);
  }

  @Test()
  async verifyGetUser() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(config.paths['/test/user'].get);
    assert(config.paths['/test/user'].get.parameters?.length === 1);

    const param = config.paths['/test/user'].get.parameters?.[0];
    assert('name' in param);
    assert(param.required);
    assert(param.name === 'name');
    assert(param.in === 'query');

    assert(config.paths['/test/user'].get.responses?.['200']);
    assert.deepStrictEqual(config.paths['/test/user'].get.responses['200'], {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/TestUser' }
        }
      },
      description: ''
    });
  }

  @Test()
  async verifyGetUsers() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(config.paths['/test/users'].get);
    assert(config.paths['/test/users'].get.parameters?.length === 1);

    const param = config.paths['/test/users'].get.parameters?.[0];
    assert('name' in param);
    assert(param.required);
    assert(param.name === 'name');
    assert(param.in === 'query');

    assert(config.paths['/test/users'].get.responses?.['200']);
    assert.deepStrictEqual(config.paths['/test/users'].get.responses['200'], {
      content: {
        'application/json': {
          schema: { type: 'array', items: { $ref: '#/components/schemas/TestUser' } }
        }
      },
      description: ''
    });
  }

  @Test()
  async verifyPutNames() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(config.paths['/test/names'].put);
    assert(config.paths['/test/names'].put.parameters?.length === 1);

    assert(config.paths['/test/names'].put.responses?.['200']);
    assert.deepStrictEqual(config.paths['/test/names'].put.responses['200'], {
      content: {
        'application/json': {
          schema: { type: 'array', items: { type: 'string' } }
        }
      },
      description: ''
    });

    const param = config.paths['/test/names'].put.parameters?.[0];
    assert('name' in param);
    assert(param.required);
    assert(param.in === 'query');
    assert(param.name === 'names');

    assert.deepStrictEqual(param.schema, { type: 'array', items: { type: 'string' } });
  }

  @Test()
  async verifyPatchWho() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(config.paths['/test/who'].patch);
    assert(config.paths['/test/who'].patch.responses?.['200']);
    assert.deepStrictEqual(config.paths['/test/who'].patch.responses['200'], {
      content: {
        'application/json': {
          schema: { type: 'array', items: { type: 'string' } }
        }
      },
      description: ''
    });

    assert(config.paths['/test/who'].patch.parameters?.length === 0);
    assert(config.paths['/test/who'].patch.requestBody);

    assert.deepStrictEqual(config.paths['/test/who'].patch.requestBody, {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/who__12130'
          }
        }
      },
      description: ''
    });
    assert.deepStrictEqual(config.components.schemas['who__12130'], {
      description: undefined,
      examples: undefined,
      properties: {
        color: {
          description: undefined,
          type: 'string'
        },
        name: {
          description: undefined,
          type: 'string'
        }
      },
      required: [
        'name',
        'color'
      ],
    });
  }

  @Test()
  async verifyDeleteOne() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(config.paths['/test/{id}'].delete);
    assert(config.paths['/test/{id}'].delete.responses?.['201']);
    assert.deepStrictEqual(config.paths['/test/{id}'].delete.responses['201'], {
      content: {},
      description: ''
    });

    assert(config.paths['/test/{id}'].delete.parameters?.length === 1);
    assert(!config.paths['/test/{id}'].delete.requestBody);

    const param = config.paths['/test/{id}'].delete.parameters?.[0];
    assert('name' in param);
    assert(param.required);
    assert(param.in === 'path');
    assert(param.name === 'id');
    assert.deepStrictEqual(param.schema, { type: 'string' });
  }

  @Test()
  async verifyDeleteAll() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(config.paths['/test/all/{id}'].delete);
    assert(config.paths['/test/all/{id}'].delete.responses?.['201']);
    assert.deepStrictEqual(config.paths['/test/all/{id}'].delete.responses['201'], {
      content: {},
      description: ''
    });

    assert(config.paths['/test/all/{id}'].delete.parameters?.length === 4);
    assert(!config.paths['/test/all/{id}'].delete.requestBody);

    const param = config.paths['/test/all/{id}'].delete.parameters?.[0];
    assert('name' in param);
    assert(param.required);
    assert(param.in === 'path');
    assert(param.name === 'id');
    assert.deepStrictEqual(param.schema, { type: 'string' });

    const param2 = config.paths['/test/all/{id}'].delete.parameters?.[1];
    assert('name' in param2);
    assert(param2.required);
    assert(param2.in === 'query');
    assert(param2.name === 'age');
    assert.deepStrictEqual(param2.schema, { type: 'number' });

    const param3 = config.paths['/test/all/{id}'].delete.parameters?.[2];
    assert('name' in param3);
    assert(param3.required);
    assert(param3.in === 'query');
    assert(param3.name === 'name');
    assert.deepStrictEqual(param3.schema, { type: 'string' });

    const param4 = config.paths['/test/all/{id}'].delete.parameters?.[3];
    assert('name' in param4);
    assert(param4.required);
    assert(param4.in === 'query');
    assert(param4.name === 'salary');
    assert.deepStrictEqual(param4.schema, { type: 'number' });
  }

  @Test()
  async verifyHeadAll() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(config.paths['/test/all/{id}'].head);
    assert(config.paths['/test/all/{id}'].head.responses?.['201']);
    assert.deepStrictEqual(config.paths['/test/all/{id}'].head.responses['201'], {
      content: {},
      description: ''
    });

    assert(config.paths['/test/all/{id}'].head.parameters?.length === 4);
    assert(!config.paths['/test/all/{id}'].head.requestBody);

    const param = config.paths['/test/all/{id}'].head.parameters?.[0];
    assert('name' in param);
    assert(param.required);
    assert(param.in === 'path');
    assert(param.name === 'id');
    assert.deepStrictEqual(param.schema, { type: 'string' });

    const param2 = config.paths['/test/all/{id}'].head.parameters?.[1];
    assert('name' in param2);
    assert(!param2.required);
    assert(param2.in === 'query');
    assert(param2.name === 'age');
    assert.deepStrictEqual(param2.schema, { type: 'number' });

    const param3 = config.paths['/test/all/{id}'].head.parameters?.[2];
    assert('name' in param3);
    assert(!param3.required);
    assert(param3.in === 'query');
    assert(param3.name === 'name');
    assert.deepStrictEqual(param3.schema, { type: 'string' });

    const param4 = config.paths['/test/all/{id}'].head.parameters?.[3];
    assert('name' in param4);
    assert(!param4.required);
    assert(param4.in === 'query');
    assert(param4.name === 'salary');
    assert.deepStrictEqual(param4.schema, { type: 'number' });
  }

  @Test()
  async verifyDownload() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(config.paths['/test/download'].get);
    assert(config.paths['/test/download'].get.responses?.['200']);
    assert.deepStrictEqual(config.paths['/test/download'].get.responses['200'], {
      content: {
        'application/octet-stream': { schema: { type: 'string', format: 'binary' } }
      },
      description: 'Raw binary data'
    });

    const param = config.paths['/test/download'].get.parameters?.[0];
    assert(param);
    assert('name' in param);
    assert(!param.required);
    assert(param.in === 'query');
    assert(param.name === 'size');
    assert.deepStrictEqual(param.schema, { type: 'number' });
  }

  @Test()
  async verifyUndocumented() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(!config.paths['/test/random']);
  }

  @Test()
  async querySchema() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));

    assert(config.paths['/test/user-search']);
    assert(config.paths['/test/user-search'].get);
    assert(config.paths['/test/user-search'].get.parameters);
    assert(config.paths['/test/user-search'].get.parameters.length === 2);
    assert('in' in config.paths['/test/user-search'].get.parameters[0]);
    assert(config.paths['/test/user-search'].get.parameters[0].in === 'query');
    assert(config.paths['/test/user-search'].get.parameters[0].name === 'name');

    assert('in' in config.paths['/test/user-search'].get.parameters[1]);
    assert(config.paths['/test/user-search'].get.parameters[1].in === 'query');
    assert(config.paths['/test/user-search'].get.parameters[1].name === 'age');
  }

  @Test()
  async bodySchema() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));

    assert(config.paths['/test/user-search']);
    assert(config.paths['/test/user-search'].post);
    assert.deepStrictEqual(config.paths['/test/user-search'].post.requestBody, {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/UserSearch__86636'
          }
        }
      },
      description: ''
    });

  }

  @Test()
  async querySchemaPrefix() {
    const config = await ControllerVisitUtil.visit(new OpenapiVisitor({}));
    assert(config.paths['/test/user-search-prefix']);
    assert(config.paths['/test/user-search-prefix'].get);
    assert(config.paths['/test/user-search-prefix'].get.parameters);
    assert(config.paths['/test/user-search-prefix'].get.parameters.length === 2);
    assert('in' in config.paths['/test/user-search-prefix'].get.parameters[0]);
    assert(config.paths['/test/user-search-prefix'].get.parameters[0].in === 'query');
    assert(config.paths['/test/user-search-prefix'].get.parameters[0].name === 'search.name');

    assert('in' in config.paths['/test/user-search-prefix'].get.parameters[1]);
    assert(config.paths['/test/user-search-prefix'].get.parameters[1].in === 'query');
    assert(config.paths['/test/user-search-prefix'].get.parameters[1].name === 'search.age');
  }
}