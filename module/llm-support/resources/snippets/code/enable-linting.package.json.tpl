{
  "name": "sample-app",
  "private": true,
  "type": "module",
  "scripts": {
    "lint:register": "trv lint:register",
    "lint": "npm run lint:register && trv lint",
    "lint:fix": "npm run lint:register && trv lint --fix"
  },
  "devDependencies": {
    "@travetto/lint": "^8.0.0-alpha.20"
  }
}
