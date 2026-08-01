import { RuntimeError } from '@travetto/runtime';
import { Email, Min, Schema } from '@travetto/schema';
import { Controller, Delete, Get, Post } from '@travetto/web';

@Schema()
export class CreateUserDto {
  username: string;

  @Email()
  email: string;
}

@Schema()
export class UserResponseDto {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

@Controller('/api/users')
export class UserController {
  /**
   * Search users by query
   */
  @Get('/')
  async searchUsers(query?: string, @Min(1) limit: number = 20): Promise<UserResponseDto[]> {
    return [];
  }

  /**
   * Retrieve a user by identifier
   */
  @Get('/:id')
  async getUserById(id: string): Promise<UserResponseDto> {
    if (!id || id === '0') {
      throw new RuntimeError('User not found', { category: 'notfound' });
    }
    return {
      id,
      username: 'john_doe',
      email: 'john@example.com',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create a new user account
   */
  @Post('/')
  async createUser(body: CreateUserDto): Promise<UserResponseDto> {
    return {
      id: `usr_${Date.now()}`,
      username: body.username,
      email: body.email,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Delete user account by identifier
   */
  @Delete('/:id')
  async deleteUser(id: string): Promise<{ deleted: boolean }> {
    return { deleted: true };
  }
}
