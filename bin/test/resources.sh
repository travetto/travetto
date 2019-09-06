#!/bin/bash

function start_if_missing() {
  if ! (netstat -lan | grep LISTEN | grep ":$1 " > /dev/null); then
    docker run -it --rm -d -l unit-test -p $1:$1 ${@:2}
  fi
}

function cleanup() {
  docker ps -q --filter 'label=unit-test' | xargs docker kill
}

if [[ ("$1" == "stop") || ("$1" == "restart") ]]; then
  cleanup
fi

if [[ ("$1" == "start") || ("$1" == "restart") ]]; then
  start_if_missing 5432 -e POSTGRES_USER=root -e POSTGRES_PASSWORD=password -e POSTGRES_DB=app postgres:11.4-alpine 
  start_if_missing 3306 -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=app mysql:5.6 
  start_if_missing 9200 -e "discovery.type=single-node" docker.elastic.co/elasticsearch/elasticsearch:6.8.2
  start_if_missing 6379 redis:5-alpine
  start_if_missing 27017 mongo:3.6
fi

