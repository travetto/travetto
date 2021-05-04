import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { Controller, Delete, Get, Head, Patch, Put } from '@travetto/rest';
import { BeforeAll, Suite, Test } from '@travetto/test';

import { SpecGenerator } from '../src/spec-generate';
import { TestUser } from './model';
import { ParameterObject } from 'openapi3-ts/src/model/OpenApi';

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
}

@Suite()
export class GenerateSuite {
  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test()
  async verifyGeneral() {
    const config = new SpecGenerator().generate({});
    assert(config);
    assert(Object.keys(config.paths).length === 6);
    assert(Object.keys(config.components.schemas).length === 2);
  }

  @Test()
  async verifyGetUser() {
    const config = new SpecGenerator().generate({});
    assert(config.paths['/test/user'].get);
    assert(config.paths['/test/user'].get.parameters?.length === 1);

    const param = (config.paths['/test/user'].get.parameters?.[0] as ParameterObject);
    assert(param.required);
    assert(param.name === 'name');
    assert(param.in === 'query');

    assert(config.paths['/test/user'].get.responses['200']);
    assert(config.paths['/test/user'].get.responses['200'] === {
      content: {
        'application/json': {
          schema: { '$ref': '#/components/schemas/TestUser' }
        }
      },
      description: ''
    });
  }

  @Test()
  async verifyGetUsers() {
    const config = new SpecGenerator().generate({});
    assert(config.paths['/test/users'].get);
    assert(config.paths['/test/users'].get.parameters?.length === 1);

    const param = (config.paths['/test/users'].get.parameters?.[0] as ParameterObject);
    assert(param.required);
    assert(param.name === 'name');
    assert(param.in === 'query');

    assert(config.paths['/test/users'].get.responses['200']);
    assert(config.paths['/test/users'].get.responses['200'] === {
      content: {
        'application/json': {
          schema: { type: 'array', items: { '$ref': '#/components/schemas/TestUser' } }
        }
      },
      description: ''
    });
  }

  @Test()
  async verifyPutNames() {
    const config = new SpecGenerator().generate({});
    assert(config.paths['/test/names'].put);
    assert(config.paths['/test/names'].put.parameters?.length === 1);

    assert(config.paths['/test/names'].put.responses['200']);
    assert(config.paths['/test/names'].put.responses['200'] === {
      content: {
        'application/json': {
          schema: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    const param = (config.paths['/test/names'].put.parameters?.[0] as ParameterObject);
    assert(param.required);
    assert(param.in === 'query');
    assert(param.name === 'names');

    assert(param.schema === { type: 'array', items: { type: 'string' } });
  }

  @Test()
  async verifyPatchWho() {
    const config = new SpecGenerator().generate({});
    assert(config.paths['/test/who'].patch);
    assert(config.paths['/test/who'].patch.responses['200']);
    assert(config.paths['/test/who'].patch.responses['200'] === {
      content: {
        'application/json': {
          schema: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    assert(config.paths['/test/who'].patch.parameters?.length === 0);
    assert(config.paths['/test/who'].patch.requestBody);

    assert(config.paths['/test/who'].patch.requestBody === {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/who_27_31'
          }
        }
      },
      description: '__type'
    });
  }

  @Test()
  async verifyDeleteOne() {
    const config = new SpecGenerator().generate({});
    assert(config.paths['/test/{id}'].delete);
    assert(config.paths['/test/{id}'].delete.responses['201']);
    assert(config.paths['/test/{id}'].delete.responses['201'] === {
      content: {},
      description: ''
    });

    assert(config.paths['/test/{id}'].delete.parameters?.length === 1);
    assert(!config.paths['/test/{id}'].delete.requestBody);

    const param = (config.paths['/test/{id}'].delete.parameters?.[0] as ParameterObject);
    assert(param.required);
    assert(param.in === 'path');
    assert(param.name === 'id');
    assert(param.schema === { type: 'string' });
  }

  @Test()
  async verifyDeleteAll() {
    const config = new SpecGenerator().generate({});
    assert(config.paths['/test/all/{id}'].delete);
    assert(config.paths['/test/all/{id}'].delete.responses['201']);
    assert(config.paths['/test/all/{id}'].delete.responses['201'] === {
      content: {},
      description: ''
    });

    assert(config.paths['/test/all/{id}'].delete.parameters?.length === 4);
    assert(!config.paths['/test/all/{id}'].delete.requestBody);

    const param = (config.paths['/test/all/{id}'].delete.parameters?.[0] as ParameterObject);
    assert(param.required);
    assert(param.in === 'path');
    assert(param.name === 'id');
    assert(param.schema === { type: 'string' });

    const param2 = (config.paths['/test/all/{id}'].delete.parameters?.[1] as ParameterObject);
    assert(param2.required);
    assert(param2.in === 'query');
    assert(param2.name === 'age');
    assert(param2.schema === { type: 'number' });

    const param3 = (config.paths['/test/all/{id}'].delete.parameters?.[2] as ParameterObject);
    assert(param3.required);
    assert(param3.in === 'query');
    assert(param3.name === 'name');
    assert(param3.schema === { type: 'string' });

    const param4 = (config.paths['/test/all/{id}'].delete.parameters?.[3] as ParameterObject);
    assert(param4.required);
    assert(param4.in === 'query');
    assert(param4.name === 'salary');
    assert(param4.schema === { type: 'number' });
  }


  @Test()
  async verifyHeadAll() {
    const config = new SpecGenerator().generate({});
    assert(config.paths['/test/all/{id}'].head);
    assert(config.paths['/test/all/{id}'].head.responses['201']);
    assert(config.paths['/test/all/{id}'].head.responses['201'] === {
      content: {},
      description: ''
    });

    assert(config.paths['/test/all/{id}'].head.parameters?.length === 4);
    assert(!config.paths['/test/all/{id}'].head.requestBody);

    const param = (config.paths['/test/all/{id}'].head.parameters?.[0] as ParameterObject);
    assert(param.required);
    assert(param.in === 'path');
    assert(param.name === 'id');
    assert(param.schema === { type: 'string' });

    const param2 = (config.paths['/test/all/{id}'].head.parameters?.[1] as ParameterObject);
    assert(!param2.required);
    assert(param2.in === 'query');
    assert(param2.name === 'age');
    assert(param2.schema === { type: 'number' });

    const param3 = (config.paths['/test/all/{id}'].head.parameters?.[2] as ParameterObject);
    assert(!param3.required);
    assert(param3.in === 'query');
    assert(param3.name === 'name');
    assert(param3.schema === { type: 'string' });

    const param4 = (config.paths['/test/all/{id}'].head.parameters?.[3] as ParameterObject);
    assert(!param4.required);
    assert(param4.in === 'query');
    assert(param4.name === 'salary');
    assert(param4.schema === { type: 'number' });
  }
}