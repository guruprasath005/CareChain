/**
 * Verification script for loading state indicators implementation
 * 
 * This script verifies that:
 * 1. Skeleton loader component exists and is properly structured
 * 2. All search screens import and use skeleton loaders
 * 3. Inline loading indicators are present for search operations
 * 4. Loading states don't block UI (jobs/employees remain visible while loading more)
 */

import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  passed: boolean;
  message: string;
}

function verifyFileExists(filePath: string): VerificationResult {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    return { passed: true, message: `✓ File exists: ${filePath}` };
  }
  return { passed: false, message: `✗ File missing: ${filePath}` };
}

function verifyFileContains(filePath: string, searchStrings: string[]): VerificationResult {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    return { passed: false, message: `✗ File not found: ${filePath}` };
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const missingStrings: string[] = [];

  for (const searchString of searchStrings) {
    if (!content.includes(searchString)) {
      missingStrings.push(searchString);
    }
  }

  if (missingStrings.length === 0) {
    return { passed: true, message: `✓ ${filePath} contains all required elements` };
  }

  return {
    passed: false,
    message: `✗ ${filePath} missing: ${missingStrings.join(', ')}`,
  };
}

function runVerification(): void {
  console.log('🔍 Verifying Loading State Indicators Implementation\n');

  const results: VerificationResult[] = [];

  // 1. Verify SkeletonLoader component exists
  results.push(verifyFileExists('care-chain-app/app/_components/SkeletonLoader.tsx'));

  // 2. Verify SkeletonLoader has required variants
  results.push(
    verifyFileContains('care-chain-app/app/_components/SkeletonLoader.tsx', [
      "variant?: 'card' | 'list' | 'text'",
      'shimmerAnim',
      'Animated.loop',
    ])
  );

  // 3. Verify doctor search screen uses skeleton loader
  results.push(
    verifyFileContains('care-chain-app/app/(doctor)/(tabs)/search.tsx', [
      "import { SkeletonLoader } from '../../_components/SkeletonLoader'",
      '<SkeletonLoader variant="card" count={3} />',
      'isLoading && jobs.length > 0',
      '<ActivityIndicator',
    ])
  );

  // 4. Verify hospital search screen uses skeleton loader
  results.push(
    verifyFileContains('care-chain-app/app/(hospital)/(tabs)/search.tsx', [
      "import { SkeletonLoader } from '../../_components/SkeletonLoader'",
      '<SkeletonLoader variant="card" count={3} />',
      'isLoading && doctors.length > 0',
    ])
  );

  // 5. Verify hospital jobs screen uses skeleton loader
  results.push(
    verifyFileContains('care-chain-app/app/(hospital)/(tabs)/jobs.tsx', [
      "import { SkeletonLoader } from '../../_components/SkeletonLoader'",
      '<SkeletonLoader variant="card" count={3} />',
      'Filtering by:',
    ])
  );

  // 6. Verify hospital employees screen uses skeleton loader
  results.push(
    verifyFileContains('care-chain-app/app/(hospital)/(tabs)/employees.tsx', [
      "import { SkeletonLoader } from '../../_components/SkeletonLoader'",
      '<SkeletonLoader variant="card" count={3} />',
      'Filtering by:',
    ])
  );

  // 7. Verify loading states don't block UI (jobs remain visible while loading more)
  results.push(
    verifyFileContains('care-chain-app/app/(doctor)/(tabs)/search.tsx', [
      'isLoading && jobs.length === 0',
      'jobs.map((job: Job)',
    ])
  );

  // 8. Verify inline loading indicators for filter operations
  results.push(
    verifyFileContains('care-chain-app/app/(doctor)/(tabs)/search.tsx', [
      'isLoading && jobs.length > 0',
      'ActivityIndicator',
    ])
  );

  // Print results
  console.log('Results:\n');
  let passedCount = 0;
  let failedCount = 0;

  results.forEach((result) => {
    console.log(result.message);
    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  });

  console.log(`\n📊 Summary: ${passedCount} passed, ${failedCount} failed\n`);

  if (failedCount > 0) {
    console.log('❌ Verification failed. Please review the implementation.');
    process.exit(1);
  } else {
    console.log('✅ All verifications passed!');
    process.exit(0);
  }
}

// Run verification
runVerification();
