#!/bin/bash
export DEBUG=0
node -e 'require("./module/boot/bin/init").run("./bin/dev-init", "init")';