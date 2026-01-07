# OpenTelemetry Inspector

OpenTelemetry Inspector is a desktop application designed to receive, decode, and visualize OpenTelemetry data (Logs, Traces, and Metrics) in real-time. It acts as a local OTLP sink, making it easy to debug and verify telemetry output from your applications.

## Features

- **Real-time Visualization**: View traces, metrics, and logs as they arrive.
- **OTLP Support**: Receives data via OTLP over gRPC (port 4317) and HTTP (port 4318).
- **Cross-Platform**: Available for Linux (RPM/Deb), macOS, and as a Docker container.
- **Modern UI**: Built with Vue.js and PrimeVue for a sleek, responsive experience.

---

## Installation & Usage

The application can be installed as a desktop application or as a Docker container.

### Desktop Application

You can download the application for your platform from the [releases](https://github.com/vmladenov/opentelemetry-inspect/releases) page.

### Docker

You can run the inspector as a Docker container and send telemetry to it from other containers or your host.

```bash
# Pull the latest image
docker pull ghcr.io/vmladenov/opentelemetry-inspect:latest

# Run the container mapping OTLP ports
docker run -d --rm \
  -p 4317:4317 \
  -p 4318:4318 \
  --name opentelemetry-inspect \
  ghcr.io/vmladenov/opentelemetry-inspect:latest
```

### macOS (Unsigned App)

If you download the `.dmg` from the releases, macOS will likely block it because it is not signed. To run it, you may need to remove the "quarantine" attribute:

```bash
# After moving the app to your Applications folder
xattr -d com.apple.quarantine /Applications/opentelemetry-inspect.app
```

---

## Building from Source

### Prerequisites

- **Rust**: [Install Rust](https://www.rust-lang.org/tools/install)
- **Bun**: [Install Bun](https://bun.sh/)
- **Protobuf Compiler**: Needed for decoding OTLP data.
  - Linux: `sudo apt install protobuf-compiler` or `sudo dnf install protobuf-compiler`
  - macOS: `brew install protobuf`

### Build Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vmladenov/opentelemetry-inspect.git
   cd opentelemetry-inspect/app
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Build the application**:
   ```bash
   # For a production build (RPM/Deb/DMG based on your OS)
   bun tauri build
   ```

4. **Run in development mode**:
   ```bash
   bun tauri dev
   ```

---

## License

GPL-3.0 License. See [LICENSE](LICENSE) for details.
