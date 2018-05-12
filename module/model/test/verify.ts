import { Suite, Test, BeforeAll } from '@travetto/test';
import { Model, ModelQuery, ModelCore, WhereClause, BaseModel, PropWhereClause } from '..';
import { Schema, SchemaRegistry } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';
import { QueryVerifierService } from '../src/service/query';
import { RetainFields } from '../src/model/query/common';
import { Class } from '@travetto/registry';

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

    const t2: PropWhereClause<RetainFields<ModelCore>> = {

    }

    const test = <T extends ModelCore>(cls: Class<T>) => {
      const t: WhereClause<ModelCore> = {
        id: {
          $eq: '5'
        },

      };
      verifier.verify(User, t);
    }
    test(ModelUser);
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

    verifier.verify(User, query)
  }

}