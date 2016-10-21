import * as crypto from "crypto";
import * as passport from "passport";
import * as moment from "moment";

import { nodeToPromise } from '@encore/util';
import { ModelService, BaseModel } from '@encore/model'
import { Strategy as LocalStrategy } from "passport-local";
import { Context } from '@encore/express';

async function generateHash(password: string, salt: string, iterations: number = 25000, keylen: number = 512, digest: string = 'sha512') {
  return (await nodeToPromise<Buffer>(crypto, crypto.pbkdf2, password, salt, iterations, keylen, digest)).toString('hex');
}

async function generateSalt(saltlen: number = 32) {
  return (await nodeToPromise<NodeBuffer>(crypto, crypto.randomBytes, saltlen)).toString('hex');
}

async function generatePassword(password: string, saltlen: number = 32, validator?: (password: string) => Promise<boolean>) {
  if (!password) {
    throw { message: 'Missing password exception', statusCode: 501 };
  }

  if (validator !== undefined) {
    if (!await validator(password)) {
      throw { message: 'Invalid password', statusCode: 503 };
    }
  }

  let salt = await generateSalt(saltlen);
  let hash = await generateHash(password, salt);

  return { salt, hash };
}

interface Config {
  usernameField: string,
  passwordField: string,
  hashField: string,
  saltField: string,
  resetTokenField: string,
  resetExpiresField: string
}

export function MongoStrategy<T extends BaseModel>(cls: new () => T, config: Config) {

  async function login(email: string, password: string) {
    let query: any = {
      [config.usernameField]: email
    };

    try {
      let user = await ModelService.findOne(cls, query);
      let hash = await generateHash(password, (user as any)[config.saltField]);
      if (hash !== (user as any)[config.hashField]) {
        throw { message: "Invalid password", statusCode: 500 };
      } else {
        try {
          Context.get().user = user;
        } catch (e) {
          //Do nothing
        }
        return user;
      }
    } catch (e) {
      throw { message: "User is not found", statusCode: 404 };
    }
  }

  async function register(user: T, password: string) {
    let query: any = {
      [config.usernameField]: (user as any)[config.usernameField]
    };

    let existingUsers = await ModelService.getByQuery(cls, query);
    if (existingUsers.length) {
      throw { message: 'That email is already taken.', statusCode: 500 };
    } else {
      let fields = await generatePassword(password);
      Object.assign(user as any, {
        [config.hashField]: fields.hash,
        [config.saltField]: fields.salt
      });

      delete (user as any)[config.passwordField];

      let res = await ModelService.save(user);
      try {
        Context.get().user = user;
      } catch (e) {
        //Do nothing
      }
      return res;
    }
  }

  async function changePassword(username: string, password: string, oldPassword?: string) {
    let query: any = {
      [config.usernameField]: username
    };

    let user = await ModelService.findOne(cls, query);
    if (oldPassword !== undefined) {
      if (oldPassword === (user as any)[config.resetTokenField]) {
        if (moment((user as any)[config.resetExpiresField]).isBefore(new Date())) {
          throw { message: 'Reset token has expired', statusCode: 500 };
        }
      } else {
        let pw = await generateHash(oldPassword, (user as any)[config.saltField]);
        if (pw !== (user as any)[config.hashField]) {
          throw { message: 'Old password is required to change', statusCode: 500 };
        }
      }
    }

    let fields = await generatePassword(password);

    Object.assign(user as any, {
      [config.hashField]: fields.hash,
      [config.saltField]: fields.salt
    });

    return await ModelService.update(user);
  }

  async function generateResetToken(username: string) {
    let query: any = {
      [config.usernameField]: username
    };

    let user = await ModelService.findOne(cls, query);
    let salt = await generateSalt();
    let password = await generateHash('' + (new Date().getTime()), salt, 25000, 32);

    Object.assign(user as any, {
      [config.resetTokenField]: password,
      [config.resetExpiresField]: moment().add(1, "hour").toDate()
    });

    let res = await ModelService.update(user);
    return user;
  }

  // used to serialize the user for the session
  passport.serializeUser((user: T, done: Function) => done(null, user._id));

  // used to deserialize the user
  passport.deserializeUser(async (id: string, done: (err: any, user?: T) => void) => {
    ModelService.getById(cls, id).then(
      u => done(null, u),
      err => done(err));
  });

  passport.use('local', new LocalStrategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField: config.usernameField,
    passwordField: config.passwordField,
    passReqToCallback: true // allows us to pass back the entire request to the callback
  }, async (req, email, password, done) => {
    try {
      done(null, await login(email, password));
    } catch (e) {
      done(e);
    }
  }));

  return {
    login,
    register,
    changePassword,
    generateResetToken
  }
}