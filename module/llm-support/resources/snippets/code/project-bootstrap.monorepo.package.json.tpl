{
  "name": "{{projectName}}",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "start": "npm run -w {{workspaceName}} start",
    "test": "npm run -w {{workspaceName}} test"
  }
}
