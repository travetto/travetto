#!/bin/bash
ROOT=$(realpath $(dirname $(dirname $0)))
ln -sf $ROOT/module/cli/bin/trv.js $ROOT/.bin/trv