# Binary Download and Pinning Module

This module provides functionality for downloading and managing CLI binaries in GitHub Actions, specifically designed for the Taskmaster CLI integration.

## Features

- **Multi-platform support**: Automatic detection and support for Linux, Windows, and macOS with x64/arm64 architectures
- **Version pinning**: Pin specific versions of binaries with intelligent storage management
- **Download management**: Handle HTTP/HTTPS downloads with redirect support and proper error handling
- **Checksum validation**: Support for SHA256 and SHA512 checksum verification against known good values
- **Secure checksum retrieval**: Retrieve checksums from remote sources with proper validation
- **Checksum mismatch handling**: Automatic retry and error reporting for corrupted downloads
- **Storage management**: Organized binary storage with cleanup utilities
- **GitHub Actions integration**: Seamless integration with GitHub Actions environment

## Architecture

The module consists of three main components:

### Platform Utils (`platform-utils.ts`)
- **`detectPlatform()`**: Auto-detect current OS and architecture
- **`getBinaryName()`**: Generate platform-specific binary names
- **`getBinaryDownloadUrl()`**: Construct download URLs

### Binary Downloader (`binary-downloader.ts`)
- **`downloadBinary()`**: Main download function with version pinning
- **`getBinaryPath()`**: Get path to specific binary version
- **`isBinaryAvailable()`**: Check if binary version exists locally
- **`listAvailableVersions()`**: List all locally available versions
- **`cleanupOldVersions()`**: Remove old versions to save space

### Public API (`index.ts`)
- Exports all public interfaces and functions
- Provides TypeScript type definitions

## Usage Examples

### Basic Binary Download

```typescript
import { downloadBinary } from '@scripts/index';

const binaryInfo = await downloadBinary({
  baseUrl: 'https://github.com/owner/repo/releases/download',
  version: '1.0.0',
  storageDir: './bin'
});

console.log(`Binary ready at: ${binaryInfo.binaryPath}`);
```

### Checksum Validation

```typescript
import { downloadBinary, ChecksumOptions } from '@scripts/index';

// Direct checksum validation
const binaryInfo = await downloadBinary({
  baseUrl: 'https://github.com/owner/repo/releases/download',
  version: '1.0.0',
  storageDir: './bin',
  checksum: {
    value: 'abc123...', // SHA256 or SHA512 hash
    algorithm: 'sha256'  // or 'sha512'
  }
});

console.log(`Binary verified: ${binaryInfo.checksumVerified}`);
```

### Remote Checksum Validation

```typescript
// Retrieve checksum from remote URL
const binaryInfo = await downloadBinary({
  baseUrl: 'https://github.com/owner/repo/releases/download',
  version: '1.0.0',
  storageDir: './bin',
  checksum: {
    url: 'https://github.com/owner/repo/releases/download/v1.0.0/checksums.txt',
    algorithm: 'sha256'
  }
});

console.log(`Binary verified against remote checksum: ${binaryInfo.checksumVerified}`);
```

### GitHub Actions Integration

```typescript
import * as core from '@actions/core';
import { downloadBinary, getTaskmasterConfigFromInputs } from './taskmaster-cli';

// In your action's main function
const config = getTaskmasterConfigFromInputs();
const binaryInfo = await setupTaskmasterCli(config);

// Binary is now ready for execution
core.setOutput('binary-path', binaryInfo.binaryPath);
```

### Version Management

```typescript
import { listAvailableVersions, cleanupOldVersions } from '@scripts/index';

// List all available versions
const versions = listAvailableVersions('./bin');
console.log('Available versions:', versions);

// Clean up old versions, keep only 3 most recent
cleanupOldVersions('./bin', 3);
```

## Configuration

### Action Inputs

When used in GitHub Actions, the module supports these inputs:

- `taskmaster-version`: Version to download (default: '1.0.0')
- `taskmaster-base-url`: Base URL for downloads
- `force-download`: Force re-download even if binary exists

### Storage Location

Binaries are stored using this naming convention:
```
{binaryName}-{version}-{os}-{arch}{extension}
```

Examples:
- `taskmaster-1.0.0-linux-x64`
- `taskmaster-1.0.0-windows-x64.exe`
- `taskmaster-1.0.0-darwin-arm64`

## Error Handling

The module provides comprehensive error handling for:

- Network failures during download
- Unsupported platforms or architectures
- File system permission issues
- Invalid binary files
- HTTP redirect chains

## Integration with Issues #221 and #222

This module provides the foundation for:

- **Issue #221 (Checksum validation)**: ✅ **COMPLETED** - Full checksum validation with SHA256/SHA512 support, remote checksum retrieval, and secure verification
- **Issue #222 (Wrapper scripts)**: ✅ **COMPLETED** - Full wrapper script generation with platform-specific support, PATH management, and environment variable passing

## Platform Support

| Platform | Architectures | File Extension | Status |
|----------|---------------|----------------|---------|
| Linux    | x64, arm64    | (none)         | ✅ Supported |
| Windows  | x64, arm64    | .exe           | ✅ Supported |
| macOS    | x64, arm64    | (none)         | ✅ Supported |

## TypeScript Support

Full TypeScript support with exported interfaces:

- `BinaryDownloadOptions`: Configuration for downloads with optional checksum validation and wrapper creation
- `BinaryInfo`: Information about downloaded binaries including checksum verification status and wrapper details
- `ChecksumOptions`: Configuration for checksum validation (direct value or remote URL)
- `PlatformInfo`: Platform detection results
- `WrapperScriptOptions`: Configuration for wrapper script generation
- `WrapperScriptInfo`: Information about generated wrapper scripts

## Future Enhancements

Prepared for future enhancements in dependent issues:

- **Caching optimizations**: Storage management supports efficient caching
- **Proxy support**: Download function can be extended for proxy support

## Completed Enhancements

- **Checksum validation** (Issue #221): ✅ Implemented with SHA256/SHA512 support and secure validation
- **Wrapper scripts** (Issue #222): ✅ **COMPLETED** - Full wrapper script generation with platform-specific support, PATH management, and environment variable passing