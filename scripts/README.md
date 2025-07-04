# Scripts

This directory contains shared utility scripts used by the Taskmaster GitHub Actions.

## Contents

### Binary Download and Pinning Module
- `binary-downloader.ts` - Main binary download module with version pinning
- `platform-utils.ts` - Platform detection utilities for OS/architecture support
- `wrapper-scripts.ts` - Wrapper script generation for platform-specific execution
- `index.ts` - Public API exports

### Available Features
- **Binary downloading**: Download CLI binaries from remote sources
- **Version pinning**: Pin specific versions with storage management
- **Multi-platform support**: Linux, Windows, macOS with x64/arm64 architectures
- **Binary storage**: Managed storage with cleanup utilities
- **Platform detection**: Automatic OS and architecture detection
- **Wrapper scripts**: Generate platform-specific wrapper scripts for easy execution
- **PATH management**: Add wrapper scripts to PATH for convenient access
- **Environment variable passing**: Configure environment variables for binary execution

## Usage

### Basic Usage
```typescript
import { downloadBinary, BinaryDownloadOptions } from './scripts';

const options: BinaryDownloadOptions = {
  baseUrl: 'https://github.com/owner/taskmaster/releases/download',
  version: '1.0.0',
  storageDir: './bin'
};

const binaryInfo = await downloadBinary(options);
console.log(`Binary available at: ${binaryInfo.binaryPath}`);
```

### Platform Detection
```typescript
import { detectPlatform, getBinaryName } from './scripts';

const platform = detectPlatform();
const binaryName = getBinaryName(platform);
// Example output: 'taskmaster-linux-x64'
```

### Version Management
```typescript
import { listAvailableVersions, cleanupOldVersions } from './scripts';

// List all locally available versions
const versions = listAvailableVersions('./bin');

// Clean up old versions, keeping only the 3 most recent
cleanupOldVersions('./bin', 3);
```

### Wrapper Scripts
```typescript
import { downloadBinary, createWrapperScript, setupWrapperEnvironment } from './scripts';

// Download binary with automatic wrapper creation
const binaryInfo = await downloadBinary({
  baseUrl: 'https://github.com/owner/taskmaster/releases/download',
  version: '1.0.0',
  storageDir: './bin',
  createWrapper: true,  // Default is true
  wrapperOptions: {
    wrapperName: 'tm',  // Custom wrapper name
    envVars: {
      'TM_CONFIG': '/path/to/config'
    }
  }
});

// Wrapper info is included in result
if (binaryInfo.wrapperInfo) {
  console.log(`Wrapper created at: ${binaryInfo.wrapperInfo.wrapperPath}`);
  
  // Add wrapper directory to PATH
  setupWrapperEnvironment('./bin');
  
  // Now you can run 'tm' from anywhere
}

// Manually create wrapper for existing binary
const wrapperInfo = await createWrapperScript({
  binaryPath: '/path/to/binary',
  wrapperDir: './bin',
  wrapperName: 'taskmaster',
  envVars: {
    'DEBUG': 'true'
  }
});
```

## Building

Scripts in this directory are designed to be called by the GitHub Actions or used during development and testing.

```bash
# Build the TypeScript modules
cd scripts
npm install
npm run build
```