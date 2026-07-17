{
  "name": "sample-app",
  "private": true,
  "type": "module",
  "scripts": {
    "lint:register": "trv lint:register",
    "lint": "npm run lint:register && trv lint:check && trv lint:format --check",
    "lint:fix": "npm run lint:register && trv lint:check --fix && trv lint:format"
  },
  "devDependencies": {
    "@travetto/lint": "^8.0.0-alpha.20"
  }
}
