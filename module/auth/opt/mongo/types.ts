export interface MongoStrategyConfig {
  usernameField: string;
  passwordField: string;
  hashField: string;
  saltField: string;
  resetTokenField: string;
  resetExpiresField: string;
}