# Desktop Ollama

A desktop application wrapper around [Ollama](https://ollama.com/) built with [Tauri](https://tauri.app/) and [ollama-rs](https://github.com/pepperoni21/ollama-rs).

![Desktop Ollama Demo](resources/Desktop%20Ollama%20Demo.gif)

## Usage

### 1. Install Ollama

Follow the instructions at [Ollama's official site](https://ollama.com/download) to install Ollama locally.

For macOS (using Homebrew):
```sh
brew install ollama
```

For Windows and Linux, see the [Ollama installation docs](https://ollama.com/download).

### 2. Install Rust

Install Rust using [rustup](https://rustup.rs/):

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

After installation, restart your terminal and verify with:
```sh
rustc --version
```

### 3. Install Cargo Tauri

Install the Tauri CLI globally:
```sh
cargo install tauri-cli
```

### 4. Clone this repository

```sh
git clone https://github.com/kevinbednarek/desktop-ollama.git
cd desktop-ollama
```

### 5. Build and run the desktop application

To build and run the app in development mode:
```sh
cargo tauri dev
```

To build a release version (installer/binary):
```sh
cargo tauri build
```
The built application will be available in the `src-tauri/target/release/bundle` directory.

## Roadmap
### Chat
- [x] Chat streaming
- [x] Enable conversation history
- [x] New conversation
- [ ] Enable system prompts
- [ ] Enable custom models
- [ ] Enable multi-modal models
  - [ ] Image input
  - [ ] Image output
- [ ] File upload for prompt context
- [ ] Tool support
  - [ ] Web browsing (DuckDuckGo)
  - [ ] Scraper
  - [ ] Calculator
- [ ] Function calling
- [ ] Custom model options
- [ ] Structured output - templates
- [ ] Structured output - dynamic
- [x] Support embedding models
- [ ] Enable batch embedding generation
### UI
- [ ] Dark mode
- [ ] Disable buttons during async operations
- [ ] Adding animations during processing/loading
### Misc Features
- [x] Model download
- [ ] Model download stream with progress indicator 
- [x] Model delete
- [x] Show model info
- [ ] App startup checks
  - [ ] Check if Ollama is installed
  - [ ] Check if Ollama is running
  - [ ] Check for available models
    - [x] Initialize models on startup
    - [ ] Show an error if no models are available
- [ ] Assisted Ollama installation
- [ ] Ollama update checks
- [ ] Show Ollama status
- [x] Show model capabilities
- [ ] More convenient app download
### Code Cleanup
- [ ] Clean up Typescript code
- [ ] Add error handling