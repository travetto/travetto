import { Config } from '@travetto/config';
import { Inject } from '@travetto/di';
import { RuntimeError } from '@travetto/runtime';
import { Email, Schema } from '@travetto/schema';
import { Controller, Get, Post } from '@travetto/web';

@Config('aws.lambda')
export class AwsLambdaConfig {
  functionName: string = 'api-service';
  memorySize: number = 512;
  timeout: number = 15;
}

@Schema()
export class LambdaUserRequest {
  username: string;

  @Email()
  email: string;
}

@Schema()
export class LambdaUserResponse {
  id: string;
  username: string;
  email: string;
  processedAt: string;
}

@Controller('/aws-lambda/users')
export class AwsLambdaUserController {
  @Inject()
  config: AwsLambdaConfig;

  @Get('/health')
  async checkHealth() {
    return {
      status: 'ok',
      functionName: this.config.functionName,
      timestamp: new Date().toISOString()
    };
  }

  @Post('/')
  async createUser(payload: LambdaUserRequest): Promise<LambdaUserResponse> {
    if (payload.username === 'admin') {
      throw new RuntimeError('Reserved username', { category: 'data' });
    }
    return {
      id: `usr_${Date.now()}`,
      username: payload.username,
      email: payload.email,
      processedAt: new Date().toISOString()
    };
  }
}
