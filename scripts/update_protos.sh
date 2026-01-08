#!/bin/bash

# Base URL for OpenTelemetry Proto files
BASE_URL="https://raw.githubusercontent.com/open-telemetry/opentelemetry-proto/refs/heads/main/opentelemetry/proto"

# Local target directory relative to this script's location
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
TARGET_BASE_DIR="$ROOT_DIR/app/src-tauri/opentelemetry/proto"

# List of proto files to download
PROTOS=(
    "collector/logs/v1/logs_service.proto"
    "collector/metrics/v1/metrics_service.proto"
    "collector/trace/v1/trace_service.proto"
    "common/v1/common.proto"
    "logs/v1/logs.proto"
    "metrics/v1/metrics.proto"
    "resource/v1/resource.proto"
    "trace/v1/trace.proto"
)

echo "Updating OpenTelemetry proto files in $TARGET_BASE_DIR..."

for proto in "${PROTOS[@]}"; do
    URL="$BASE_URL/$proto"
    OUTPUT_PATH="$TARGET_BASE_DIR/$proto"
    
    # Create the directory for the file if it doesn't exist
    mkdir -p "$(dirname "$OUTPUT_PATH")"
    
    echo "Downloading $proto..."
    curl -L -s -o "$OUTPUT_PATH" "$URL"
    
    if [ $? -eq 0 ]; then
        echo "Successfully updated $proto"
    else
        echo "Error downloading $proto"
    fi
done

echo "Update complete."
