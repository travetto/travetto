#!/bin/sh
node -r './bin/npm/.env.js' -e 'require("./bin/npm/upgrade").run()'