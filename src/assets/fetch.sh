#!/bin/sh

curl \
  -L \
  -Z \
  --output-dir "$(dirname "$0")" \
  -O https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css \
  -O https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.min.js \
  -O https://raw.githubusercontent.com/simple-icons/simple-icons/9.9.0/icons/github.svg
