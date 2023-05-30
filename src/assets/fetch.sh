#!/bin/sh

wget \
  -P "$(dirname "$0")" \
  https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css \
  https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.min.js \
  https://cdn.jsdelivr.net/npm/simple-icons@9.0.0/icons/github.svg
