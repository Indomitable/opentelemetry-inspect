# Stage 1: Backend Builder
FROM rust:1.92-slim as backend-builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    musl-tools \
    && rm -rf /var/lib/apt/lists/*

# Add musl target for static linking
RUN rustup target add x86_64-unknown-linux-musl

WORKDIR /app

# Copy the entire workspace
COPY src-tauri/. .

# Build the backend statically linked for musl
RUN cargo build --release --target x86_64-unknown-linux-musl --no-default-features --features docker

# Stage 2: Frontend Builder
FROM oven/bun:latest as frontend-builder

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Stage 3: Final Image
FROM scratch

WORKDIR /app

# Copy backend binary (statically linked)
COPY --from=backend-builder /app/target/x86_64-unknown-linux-musl/release/opentelemetry-inspect /app/opentelemetry-inspect

# Copy frontend static files
COPY --from=frontend-builder /app/dist /app/dist

# Set environment variables
ENV STATIC_DIR=/app/dist

# Expose the OTLP and Web port
EXPOSE 4317
EXPOSE 4318

# Run the application
ENTRYPOINT ["/app/opentelemetry-inspect"]
