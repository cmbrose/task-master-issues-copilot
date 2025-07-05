#!/usr/bin/env ts-node

/**
 * Simple test for new enhanced error handling methods
 */

import { createGitHubApiClient } from '../scripts/github-api';

async function testNewMethods() {
  const mockConfig = {
    token: 'mock-token',
    owner: 'test-owner',
    repo: 'test-repo',
    debug: true
  };

  const client = createGitHubApiClient(mockConfig);

  console.log('Testing new enhanced error handling methods...');

  // Test new methods exist
  const methods = ['getErrorMetrics', 'getCircuitBreakerStatus', 'resetCircuitBreaker', 'clearErrorMetrics', 'performHealthCheck'];
  
  for (const method of methods) {
    if (typeof (client as any)[method] === 'function') {
      console.log(`✅ ${method} method exists`);
    } else {
      throw new Error(`${method} method not found`);
    }
  }

  // Test error metrics
  const metrics = client.getErrorMetrics();
  console.log('Error metrics structure:', Object.keys(metrics));

  // Test circuit breaker status
  const cbStatus = client.getCircuitBreakerStatus();
  console.log('Circuit breaker status structure:', Object.keys(cbStatus));

  console.log('\n🎉 All new methods are accessible!');
}

testNewMethods().catch(console.error);