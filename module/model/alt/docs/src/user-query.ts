import { ModelService } from '../../../src/service/model';
import { User } from './user';

export class UserSearch {
  service: ModelService;

  find() {
    return this.service.getAllByQuery(User, {
      where: {
        $and: [
          {
            $not: {
              age: {
                $lt: 35
              }
            }
          },
          {
            contact: {
              $exists: true
            }
          }
        ]
      }
    });
  }
}