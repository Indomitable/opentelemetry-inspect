#!/bin/bash

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

flatpak-builder --repo=$ROOT_DIR/flatpak-repo --force-clean build-dir dist/linux/com.github.indomitable.opentelemetry-inspect.yaml

flatpak build-bundle $ROOT_DIR/flatpak-repo com.github.indomitable.opentelemetry-inspect.flatpak com.github.indomitable.opentelemetry-inspect
