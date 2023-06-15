#!/bin/sh

wget \
  -P "$(dirname "$0")" \
  --backups=1 \
  https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css \
  https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.min.js \
  https://raw.githubusercontent.com/simple-icons/simple-icons/9.1.0/icons/github.svg
