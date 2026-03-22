// src/gateway/circuitBreaker.ts
// Circuit Breaker Pattern for service protection

import { logger } from '../utils/logger';

interface CircuitState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
  lastFailure: number | null;
  nextAttempt: number | null;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;     // Number of failures before opening
  resetTimeout: number;         // Time to wait before half-open (ms)
  successThreshold: number;     // Successes needed to close from half-open
  monitoringWindow: number;     // Time window for failure counting (ms)
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30000,      // 30 seconds
  successThreshold: 3,
  monitoringWindow: 60000,  // 1 minute
};

/**
 * Circuit Breaker
 * Prevents cascading failures by stopping requests to failing services
 */
export class CircuitBreaker {
  private circuits: Map<string, CircuitState> = new Map();
  private config: CircuitBreakerConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  initialize(): void {
    // Cleanup old circuit states periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.monitoringWindow);

    logger.info('Circuit breaker initialized');
  }

  /**
   * Check if a request can proceed
   */
  async canRequest(serviceName: string): Promise<boolean> {
    const circuit = this.getCircuit(serviceName);
    const now = Date.now();

    switch (circuit.status) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        // Check if we should try half-open
        if (circuit.nextAttempt && now >= circuit.nextAttempt) {
          this.transitionTo(serviceName, 'HALF_OPEN');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        // Allow limited requests in half-open state
        return true;

      default:
        return true;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(serviceName: string): void {
    const circuit = this.getCircuit(serviceName);

    if (circuit.status === 'HALF_OPEN') {
      circuit.successes++;
      
      if (circuit.successes >= this.config.successThreshold) {
        this.transitionTo(serviceName, 'CLOSED');
        logger.info(`Circuit breaker CLOSED for service: ${serviceName}`);
      }
    } else if (circuit.status === 'CLOSED') {
      // Reset failure count on success
      circuit.failures = Math.max(0, circuit.failures - 1);
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(serviceName: string): void {
    const circuit = this.getCircuit(serviceName);
    const now = Date.now();

    circuit.failures++;
    circuit.lastFailure = now;

    if (circuit.status === 'HALF_OPEN') {
      // Immediately re-open on failure during half-open
      this.transitionTo(serviceName, 'OPEN');
      logger.warn(`Circuit breaker re-OPENED for service: ${serviceName}`);
    } else if (circuit.status === 'CLOSED') {
      // Check if we should open
      if (circuit.failures >= this.config.failureThreshold) {
        this.transitionTo(serviceName, 'OPEN');
        logger.warn(`Circuit breaker OPENED for service: ${serviceName} (${circuit.failures} failures)`);
      }
    }
  }

  /**
   * Get circuit state for a service
   */
  getState(serviceName: string): CircuitState {
    return this.getCircuit(serviceName);
  }

  /**
   * Force circuit to specific state (for testing/admin)
   */
  forceState(serviceName: string, status: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    this.transitionTo(serviceName, status);
  }

  /**
   * Get all circuit states
   */
  getAllStates(): Map<string, CircuitState> {
    return new Map(this.circuits);
  }

  isHealthy(): boolean {
    // Check if any circuits are open
    for (const [, circuit] of this.circuits) {
      if (circuit.status === 'OPEN') {
        return false;
      }
    }
    return true;
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  // Private methods
  private getCircuit(serviceName: string): CircuitState {
    let circuit = this.circuits.get(serviceName);
    
    if (!circuit) {
      circuit = {
        status: 'CLOSED',
        failures: 0,
        successes: 0,
        lastFailure: null,
        nextAttempt: null,
      };
      this.circuits.set(serviceName, circuit);
    }

    return circuit;
  }

  private transitionTo(serviceName: string, status: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    const circuit = this.getCircuit(serviceName);
    const now = Date.now();

    circuit.status = status;

    switch (status) {
      case 'CLOSED':
        circuit.failures = 0;
        circuit.successes = 0;
        circuit.nextAttempt = null;
        break;

      case 'OPEN':
        circuit.successes = 0;
        circuit.nextAttempt = now + this.config.resetTimeout;
        break;

      case 'HALF_OPEN':
        circuit.successes = 0;
        break;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredTime = now - this.config.monitoringWindow * 2;

    for (const [serviceName, circuit] of this.circuits) {
      // Reset circuits that have been closed for a while with no activity
      if (
        circuit.status === 'CLOSED' &&
        circuit.failures === 0 &&
        (circuit.lastFailure === null || circuit.lastFailure < expiredTime)
      ) {
        this.circuits.delete(serviceName);
      }
    }
  }
}

export default CircuitBreaker;
