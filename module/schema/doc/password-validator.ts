import { Schema, Validator, ValidationError } from '@travetto/schema';

const passwordValidator = (user: User): ValidationError | undefined => {
  const p = user.password;
  const hasNum = /\d/.test(p);
  const hasSpecial = /[!@#$%%^&*()<>?/,.;':"']/.test(p);
  const noRepeat = !/(.)(\1)/.test(p);
  if (!hasNum || !hasSpecial || !noRepeat) {
    return {
      kind: 'password-rules',
      path: 'password',
      message: 'A password must include at least one number, one special char, and have no repeating characters'
    };
  }
};

@Schema()
@Validator(passwordValidator)
class User {
  password: string;
}