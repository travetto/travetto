import { SchemaQuery, SchemaBody, Controller, Get, Post, Put, Delete, Path } from '@travetto/rest';

import { User, UserSearch } from './model';

/**
 * User oriented operations.
 */
@Controller('/user')
export class UserController {

  /**
   * Get user by full name
   * @param name User name
   * @returns A user by name
   */
  @Get('/:name')
  async getByName(@Path() name: string): Promise<User> {
    return undefined as unknown as User;
  }

  /**
   * Get user by age
   * @param age User age
   * @returns Users by age
   */
  @Get('/age/:age')
  async getByAge(@Path() age: number = 20): Promise<User[]> {
    return undefined as unknown as User[];
  }

  /**
   * Get all users
   * @returns A list of users
   */
  @Get('/')
  async getAll(@SchemaQuery() search: UserSearch): Promise<User[]> {
    return [];
  }

  @Post('/')

  async createUser(@SchemaBody() user: User): Promise<User> {
    return undefined as unknown as User;
  }

  /**
   * Update user by id
   * @param id User id
   */
  @Put('/:id')
  async updateUser(@Path() id: number, @SchemaBody() user: User): Promise<void> {

  }
  /**
   * Delete user by id
   * @param id User id
   */
  @Delete('/:id')
  async removeUser(@Path() id: number): Promise<void> {

  }
}