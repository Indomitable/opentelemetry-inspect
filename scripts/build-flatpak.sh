#!/bin/bash

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

flatpak-builder --repo=$ROOT_DIR/flatpak-repo --force-clean build-dir dist/linux/eu.venfen.opentelemetry-inspect.yaml

flatpak build-bundle $ROOT_DIR/flatpak-repo eu.venfen.opentelemetry-inspect.flatpak eu.venfen.opentelemetry-inspect
