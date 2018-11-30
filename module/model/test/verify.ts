import * as assert from 'assert';

import { Class } from '@travetto/registry';
import { Suite, Test, BeforeAll } from '@travetto/test';
import { Schema, SchemaRegistry } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';

import { QueryVerifierService } from '../src/service/verify';
import { RetainFields } from '../src/model/where-clause';
import { Model, ModelQuery, ModelCore, WhereClause, BaseModel, PropWhereClause } from '../';
import { Query } from '../src/model/query';
import { ValidationErrors } from '../src/error';
import { QueryLanguageParser } from '../src/query-lang/parser';

@Schema()
class Preferences {
  size: number;
  language?: string;
}

@Model()
class User {
  id: number;
  email: string;
  prefs: Preferences;
}

@Model()
class ModelUser extends BaseModel {
  email: string;
}

@Suite()
export class VerifyTest {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
    await SchemaRegistry.init();
  }

  @Test()
  async verifyModelCore() {
    const verifier = await DependencyRegistry.getInstance(QueryVerifierService);

    const test = <T>(cls: Class<T>) => {
      const t: Query<ModelCore> = {
        where: {
          id: {
            $eq: '5'
          }
        }
      };
      verifier.verify(cls, t as Query<T>);
    };

    assert.throws(() => test(ModelUser), false);
    assert.throws(() => test(User), ValidationErrors);
  }

  @Test()
  async verifyNested() {
    const verifier = await DependencyRegistry.getInstance(QueryVerifierService);

    const t: RetainFields<User['prefs']> = null as any;

    const query: ModelQuery<User> = {
      where: {
        id: 5,
        prefs: {
          language: {
            $eq: 'a'
          }
        }
      }
    };

    verifier.verify(User, query);
  }

  @Test()
  async verifyQueryString() {
    const verifier = await DependencyRegistry.getInstance(QueryVerifierService);

    const test = <T>(cls: Class<T>) => {
      const t: Query<ModelCore> = {
        where: QueryLanguageParser.parse('id == "5"')
      };
      verifier.verify(cls, t as Query<T>);
    };

    assert.throws(() => test(ModelUser), false);
    assert.throws(() => test(User), ValidationErrors);

    const test2 = <T>(cls: Class<T>) => {
      const t: Query<ModelCore> = {
        where: QueryLanguageParser.parse('email ~ /bob.*/')
      };
      verifier.verify(cls, t as Query<T>);
    };

    assert.throws(() => test2(ModelUser), false);
    assert.throws(() => test2(User), false);
  }
}
