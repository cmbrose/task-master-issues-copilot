/**
 * Jest setup file for test configuration
 */

// Set test timeout to 30 seconds for integration tests
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.GITHUB_TOKEN = 'test-token';
process.env.GITHUB_OWNER = 'test-owner';
process.env.GITHUB_REPO = 'test-repo';

// Add test utilities to global scope
(global as any).testUtils = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  createMockGitHubResponse: (data: any) => ({
    status: 200,
    data,
    headers: {},
    url: 'https://api.github.com/test'
  })
};

// Console override for test isolation - only in test environment
if (process.env.NODE_ENV === 'test') {
  const originalConsole = console;
  (global as any).console = {
    ...originalConsole,
    // Suppress console.log in tests unless debugging
    log: process.env.DEBUG_TESTS ? originalConsole.log : jest.fn(),
    info: process.env.DEBUG_TESTS ? originalConsole.info : jest.fn(),
    warn: originalConsole.warn,
    error: originalConsole.error
  };
}

export {};