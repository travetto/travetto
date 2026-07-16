{
  "name": "sample-app",
  "private": true,
  "type": "module",
  "scripts": {
    "lint:register": "trv eslint:register",
    "lint": "npm run lint:register && trv eslint",
    "lint:fix": "npm run lint:register && trv eslint --fix"
  },
  "devDependencies": {
    "@travetto/eslint": "^8.0.0-alpha.20"
  }
}
