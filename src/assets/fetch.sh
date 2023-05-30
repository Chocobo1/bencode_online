#!/bin/sh

wget \
  -P "$(dirname "$0")" \
  --backups=1 \
  https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css \
  https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.min.js \
  https://raw.githubusercontent.com/simple-icons/simple-icons/9.0.0/icons/github.svg
