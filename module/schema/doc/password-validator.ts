import { Schema, Validator, ValidationError } from '@travetto/schema';

const passwordValidator = (user: User): ValidationError | undefined => {
  const password = user.password;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%%^&*()<>?/,.;':"']/.test(password);
  const noRepeat = !/(.)(\1)/.test(password);
  if (!hasNumber || !hasSpecial || !noRepeat) {
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