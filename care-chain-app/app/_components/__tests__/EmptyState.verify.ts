/**
 * Verification script for EmptyState component
 * This script validates that the EmptyState component is properly structured
 * and integrated into the search and filter screens.
 * 
 * Requirements: 1.4, 3.4, 4.4, 5.4, 8.1, 8.2, 8.3, 8.4
 */

import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  passed: boolean;
  message: string;
}

class EmptyStateVerifier {
  private results: VerificationResult[] = [];

  verify(): void {
    console.log('🔍 Verifying EmptyState Component Implementation...\n');

    this.verifyComponentExists();
    this.verifyComponentStructure();
    this.verifyTypeDefinitions();
    this.verifyScreenIntegrations();
    this.verifyRequirements();

    this.printResults();
  }

  private verifyComponentExists(): void {
    const componentPath = path.join(__dirname, '../EmptyState.tsx');
    const exists = fs.existsSync(componentPath);
    
    this.results.push({
      passed: exists,
      message: exists 
        ? '✓ EmptyState component file exists'
        : '✗ EmptyState component file not found',
    });
  }

  private verifyComponentStructure(): void {
    const componentPath = path.join(__dirname, '../EmptyState.tsx');
    
    if (!fs.existsSync(componentPath)) {
      this.results.push({
        passed: false,
        message: '✗ Cannot verify structure - component file not found',
      });
      return;
    }

    const content = fs.readFileSync(componentPath, 'utf-8');

    // Check for required exports
    const hasEmptyStateExport = content.includes('export const EmptyState');
    const hasEmptyStatePropsExport = content.includes('export interface EmptyStateProps');
    const hasEmptyStateTypeExport = content.includes('export type EmptyStateType');

    this.results.push({
      passed: hasEmptyStateExport,
      message: hasEmptyStateExport
        ? '✓ EmptyState component is exported'
        : '✗ EmptyState component export not found',
    });

    this.results.push({
      passed: hasEmptyStatePropsExport,
      message: hasEmptyStatePropsExport
        ? '✓ EmptyStateProps interface is exported'
        : '✗ EmptyStateProps interface export not found',
    });

    this.results.push({
      passed: hasEmptyStateTypeExport,
      message: hasEmptyStateTypeExport
        ? '✓ EmptyStateType is exported'
        : '✗ EmptyStateType export not found',
    });

    // Check for required props
    const hasTypeProperty = content.includes('type: EmptyStateType');
    const hasIconProperty = content.includes('icon?:');
    const hasTitleProperty = content.includes('title?:');
    const hasMessageProperty = content.includes('message?:');
    const hasOnClearSearch = content.includes('onClearSearch?:');
    const hasOnClearFilters = content.includes('onClearFilters?:');
    const hasOnRetry = content.includes('onRetry?:');

    this.results.push({
      passed: hasTypeProperty && hasIconProperty && hasTitleProperty && hasMessageProperty,
      message: (hasTypeProperty && hasIconProperty && hasTitleProperty && hasMessageProperty)
        ? '✓ All required props are defined'
        : '✗ Some required props are missing',
    });

    this.results.push({
      passed: hasOnClearSearch && hasOnClearFilters && hasOnRetry,
      message: (hasOnClearSearch && hasOnClearFilters && hasOnRetry)
        ? '✓ All action handlers are defined'
        : '✗ Some action handlers are missing',
    });
  }

  private verifyTypeDefinitions(): void {
    const componentPath = path.join(__dirname, '../EmptyState.tsx');
    
    if (!fs.existsSync(componentPath)) {
      return;
    }

    const content = fs.readFileSync(componentPath, 'utf-8');

    // Check for all required empty state types
    const types = [
      'no-search-results',
      'no-filter-results',
      'no-combined-results',
      'no-data',
      'error',
    ];

    const allTypesPresent = types.every(type => content.includes(`'${type}'`));

    this.results.push({
      passed: allTypesPresent,
      message: allTypesPresent
        ? '✓ All empty state types are defined'
        : '✗ Some empty state types are missing',
    });
  }

  private verifyScreenIntegrations(): void {
    const screens = [
      {
        name: 'Doctor Search Screen',
        path: path.join(__dirname, '../../(doctor)/(tabs)/search.tsx'),
      },
      {
        name: 'Hospital Search Screen',
        path: path.join(__dirname, '../../(hospital)/(tabs)/search.tsx'),
      },
      {
        name: 'Hospital Jobs Screen',
        path: path.join(__dirname, '../../(hospital)/(tabs)/jobs.tsx'),
      },
      {
        name: 'Hospital Employees Screen',
        path: path.join(__dirname, '../../(hospital)/(tabs)/employees.tsx'),
      },
    ];

    screens.forEach(screen => {
      if (!fs.existsSync(screen.path)) {
        this.results.push({
          passed: false,
          message: `✗ ${screen.name} not found`,
        });
        return;
      }

      const content = fs.readFileSync(screen.path, 'utf-8');
      const hasImport = content.includes("import { EmptyState } from");
      const hasUsage = content.includes("<EmptyState");

      this.results.push({
        passed: hasImport && hasUsage,
        message: (hasImport && hasUsage)
          ? `✓ ${screen.name} uses EmptyState component`
          : `✗ ${screen.name} does not use EmptyState component`,
      });
    });
  }

  private verifyRequirements(): void {
    const componentPath = path.join(__dirname, '../EmptyState.tsx');
    
    if (!fs.existsSync(componentPath)) {
      return;
    }

    const content = fs.readFileSync(componentPath, 'utf-8');

    // Requirement 8.1: Icon, message, and suggestion
    const hasIconRendering = content.includes('<Ionicons');
    const hasTitleRendering = content.includes('config.title');
    const hasMessageRendering = content.includes('config.message');

    this.results.push({
      passed: hasIconRendering && hasTitleRendering && hasMessageRendering,
      message: (hasIconRendering && hasTitleRendering && hasMessageRendering)
        ? '✓ Requirement 8.1: Displays icon, title, and message'
        : '✗ Requirement 8.1: Missing icon, title, or message rendering',
    });

    // Requirement 8.4: Actionable buttons
    const hasClearSearchButton = content.includes('Clear Search');
    const hasClearFiltersButton = content.includes('Clear Filters');
    const hasRetryButton = content.includes('Retry');

    this.results.push({
      passed: hasClearSearchButton && hasClearFiltersButton && hasRetryButton,
      message: (hasClearSearchButton && hasClearFiltersButton && hasRetryButton)
        ? '✓ Requirement 8.4: Provides actionable buttons'
        : '✗ Requirement 8.4: Missing some actionable buttons',
    });
  }

  private printResults(): void {
    console.log('\n📊 Verification Results:\n');
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    this.results.forEach(result => {
      console.log(result.message);
    });

    console.log(`\n${passed}/${total} checks passed`);
    
    if (passed === total) {
      console.log('\n✅ All verifications passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Some verifications failed');
      process.exit(1);
    }
  }
}

// Run verification
const verifier = new EmptyStateVerifier();
verifier.verify();
