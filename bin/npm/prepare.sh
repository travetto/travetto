#!/bin/bash

# Compile boot
pushd module/boot/src-ts
if [ "$1" == "watch" ]; then
  tsc -w -p . &
else
  tsc -p .
fi
popd

# Wait for all background jobs
if [ "$1" == "watch" ]; then
  for job in `jobs -p`; do  
    wait $job
  done
fi