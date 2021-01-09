import { Response, Request } from '@travetto/rest';
import { AppError } from '@travetto/base';
import { IdentitySource } from '@travetto/auth-rest';

export class SimpleIdentitySource implements IdentitySource {
  async authenticate(req: Request, res: Response) {
    const { username, password } = req.body;
    if (username === 'test' && password === 'test') {
      return {
        id: 'test',
        source: 'simple',
        permissions: [],
        details: {
          username: 'test'
        }
      };
    } else {
      throw new AppError('Invalid credentials', 'authentication');
    }
  }
}