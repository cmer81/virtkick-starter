#!/bin/bash
git pull
pushd backend > /dev/null
git pull
popd > /dev/null
pushd webapp > /dev/null
git checkout Gemfile.lock
git pull
popd > /dev/null
for file in webapp/engines/*; do
  pushd "$file" > /dev/null
  git pull
  popd > /dev/null
done

