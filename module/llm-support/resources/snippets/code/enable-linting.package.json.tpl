{
  "name": "sample-app",
  "private": true,
  "type": "module",
  "scripts": {
    "lint:register": "trv lint:register",
    "prelint": "trv lint:register",
    "lint": "trv lint",
    "prelint:fix": "trv lint:register",
    "lint:fix": "trv lint --fix"
  },
  "devDependencies": {
    "@travetto/lint": "^8.0.0-alpha.20"
  }
}
