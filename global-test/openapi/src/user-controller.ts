import { Body, Controller, Get, Post, Put, Delete, PathParam } from '@travetto/web';

import { User, UserSearch } from './model.ts';

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
  async getByName(@PathParam() name: string): Promise<User> {
    return undefined!;
  }

  /**
   * Get user by age
   * @param age User age
   * @returns Users by age
   */
  @Get('/age/:age')
  async getByAge(@PathParam() age: number = 20): Promise<User[]> {
    return [];
  }

  /**
   * Get all users
   * @returns A list of users
   */
  @Get('/')
  async getAll(search: UserSearch): Promise<User[]> {
    return [];
  }

  @Post('/')

  async createUser(@Body() user: User): Promise<User> {
    return undefined!;
  }

  /**
   * Update user by id
   * @param id User id
   */
  @Put('/:id')
  async updateUser(@PathParam() id: number, @Body() user: User): Promise<void> {

  }
  /**
   * Delete user by id
   * @param id User id
   */
  @Delete('/:id')
  async removeUser(@PathParam() id: number): Promise<void> {

  }
}