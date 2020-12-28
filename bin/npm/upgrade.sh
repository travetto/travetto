#!/bin/sh
node -r './bin/util/.env.js' -e 'require("./bin/util/upgrade").run()'