/**
 * Verification Script: useJobs hook filter parameter transmission
 * 
 * This script manually verifies that all filter parameters are correctly
 * implemented in the useJobs hook.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 9.2, 9.3
 * 
 * Run this with: npx ts-node care-chain-app/hooks/__verification__/useJobs.verification.ts
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface VerificationResult {
  check: string;
  passed: boolean;
  details: string;
}

const results: VerificationResult[] = [];

function verify(check: string, condition: boolean, details: string) {
  results.push({ check, passed: condition, details });
  console.log(`${condition ? '✓' : '✗'} ${check}`);
  if (!condition) {
    console.log(`  Details: ${details}`);
  }
}

// Read the useJobs hook file
const useJobsPath = join(__dirname, '../useJobs.ts');
const useJobsContent = readFileSync(useJobsPath, 'utf-8');

// Read the API service file
const apiPath = join(__dirname, '../../services/api.ts');
const apiContent = readFileSync(apiPath, 'utf-8');

console.log('=== useJobs Hook Verification ===\n');

// 1. Verify UseJobsOptions interface includes all required parameters
console.log('1. Checking UseJobsOptions interface...');
verify(
  'search parameter exists',
  /search\?:\s*string/.test(useJobsContent),
  'search parameter should be defined in UseJobsOptions'
);

verify(
  'specialization parameter exists',
  /specialization\?:\s*string/.test(useJobsContent),
  'specialization parameter should be defined in UseJobsOptions'
);

verify(
  'location parameter exists',
  /location\?:\s*string/.test(useJobsContent),
  'location parameter should be defined in UseJobsOptions'
);

verify(
  'jobType parameter exists',
  /jobType\?:\s*string/.test(useJobsContent),
  'jobType parameter should be defined in UseJobsOptions'
);

verify(
  'salaryMin parameter exists',
  /salaryMin\?:\s*number/.test(useJobsContent),
  'salaryMin parameter should be defined in UseJobsOptions'
);

verify(
  'salaryMax parameter exists',
  /salaryMax\?:\s*number/.test(useJobsContent),
  'salaryMax parameter should be defined in UseJobsOptions'
);

verify(
  'sortBy parameter exists',
  /sortBy\?:\s*string/.test(useJobsContent),
  'sortBy parameter should be defined in UseJobsOptions'
);

verify(
  'sortOrder parameter exists',
  /sortOrder\?:\s*string/.test(useJobsContent),
  'sortOrder parameter should be defined in UseJobsOptions'
);

// 2. Verify parameters are passed to API call
console.log('\n2. Checking parameter passing to API...');
verify(
  'search passed to API',
  /search:\s*options\.search/.test(useJobsContent),
  'search should be passed to jobsApi.searchJobs'
);

verify(
  'specialization passed to API',
  /specialization:\s*options\.specialization/.test(useJobsContent),
  'specialization should be passed to jobsApi.searchJobs'
);

verify(
  'location passed to API',
  /location:\s*options\.location/.test(useJobsContent),
  'location should be passed to jobsApi.searchJobs'
);

verify(
  'jobType passed to API',
  /jobType:\s*options\.jobType/.test(useJobsContent),
  'jobType should be passed to jobsApi.searchJobs'
);

verify(
  'salaryMin passed to API',
  /salaryMin:\s*options\.salaryMin/.test(useJobsContent),
  'salaryMin should be passed to jobsApi.searchJobs'
);

verify(
  'salaryMax passed to API',
  /salaryMax:\s*options\.salaryMax/.test(useJobsContent),
  'salaryMax should be passed to jobsApi.searchJobs'
);

verify(
  'sortBy passed to API',
  /sortBy:\s*options\.sortBy/.test(useJobsContent),
  'sortBy should be passed to jobsApi.searchJobs'
);

verify(
  'sortOrder passed to API',
  /sortOrder:\s*options\.sortOrder/.test(useJobsContent),
  'sortOrder should be passed to jobsApi.searchJobs'
);

// 3. Verify API optimization is used
console.log('\n3. Checking API optimization...');
verify(
  'useApiOptimization hook imported',
  /import.*useApiOptimization.*from/.test(useJobsContent),
  'useApiOptimization should be imported'
);

verify(
  'useApiOptimization hook used',
  /useApiOptimization<UseJobsOptions>/.test(useJobsContent),
  'useApiOptimization should be instantiated'
);

verify(
  'shouldSkipRequest check exists',
  /shouldSkipRequest\(params\)/.test(useJobsContent),
  'shouldSkipRequest should be called to prevent duplicate requests'
);

verify(
  'isRequestInProgress check exists',
  /isRequestInProgress\(\)/.test(useJobsContent),
  'isRequestInProgress should be called to prevent concurrent requests'
);

verify(
  'prepareRequest called',
  /prepareRequest\(params\)/.test(useJobsContent),
  'prepareRequest should be called before API call'
);

verify(
  'completeRequest called',
  /completeRequest\(\)/.test(useJobsContent),
  'completeRequest should be called after API call'
);

verify(
  'cancelPendingRequest called',
  /cancelPendingRequest\(\)/.test(useJobsContent),
  'cancelPendingRequest should be called when query changes'
);

// 4. Verify pagination reset logic
console.log('\n4. Checking pagination reset logic...');
verify(
  'prevQueryRef exists',
  /prevQueryRef\s*=\s*useRef/.test(useJobsContent),
  'prevQueryRef should track previous query parameters'
);

verify(
  'query change detection',
  /queryChanged\s*=.*prevQueryRef\.current/.test(useJobsContent),
  'Query change should be detected by comparing with prevQueryRef'
);

verify(
  'jobs cleared on query change',
  /setJobs\(\[\]\)/.test(useJobsContent),
  'Jobs should be cleared when query changes'
);

verify(
  'page reset on query change',
  /setCurrentPage\(1\)/.test(useJobsContent),
  'Current page should be reset to 1 when query changes'
);

// 5. Verify API service parameter mapping
console.log('\n5. Checking API service parameter mapping...');
verify(
  'search mapped to q parameter',
  /if\s*\(params\?\.search\).*query\.set\('q',\s*params\.search\)/.test(apiContent),
  'search should be mapped to q query parameter'
);

verify(
  'specialization passed through',
  /if\s*\(params\?\.specialization\).*query\.set\('specialization',\s*params\.specialization\)/.test(apiContent),
  'specialization should be passed as query parameter'
);

verify(
  'location parsed to city',
  /if\s*\(params\?\.location\)/.test(apiContent) && /query\.set\('city'/.test(apiContent),
  'location should be parsed and city extracted'
);

verify(
  'jobType passed through',
  /if\s*\(params\?\.jobType\).*query\.set\('jobType',\s*params\.jobType\)/.test(apiContent),
  'jobType should be passed as query parameter'
);

verify(
  'salaryMin mapped to minSalary',
  /if\s*\(params\?\.salaryMin.*\).*query\.set\('minSalary'/.test(apiContent),
  'salaryMin should be mapped to minSalary query parameter'
);

verify(
  'salaryMax mapped to maxSalary',
  /if\s*\(params\?\.salaryMax.*\).*query\.set\('maxSalary'/.test(apiContent),
  'salaryMax should be mapped to maxSalary query parameter'
);

verify(
  'sortBy and sortOrder combined',
  /if\s*\(params\?\.sortBy\)/.test(apiContent) && /sortOrder\s*===\s*'asc'/.test(apiContent),
  'sortBy and sortOrder should be combined into single sortBy parameter'
);

// 6. Verify fetchJobs dependencies
console.log('\n6. Checking fetchJobs dependencies...');
const fetchJobsMatch = useJobsContent.match(/\},\s*\[([\s\S]*?)\]\);[\s\S]*?useEffect/);
if (fetchJobsMatch) {
  const dependencies = fetchJobsMatch[1];
  
  verify(
    'search in dependencies',
    /options\.search/.test(dependencies),
    'options.search should be in fetchJobs dependencies'
  );
  
  verify(
    'specialization in dependencies',
    /options\.specialization/.test(dependencies),
    'options.specialization should be in fetchJobs dependencies'
  );
  
  verify(
    'location in dependencies',
    /options\.location/.test(dependencies),
    'options.location should be in fetchJobs dependencies'
  );
  
  verify(
    'jobType in dependencies',
    /options\.jobType/.test(dependencies),
    'options.jobType should be in fetchJobs dependencies'
  );
  
  verify(
    'salaryMin in dependencies',
    /options\.salaryMin/.test(dependencies),
    'options.salaryMin should be in fetchJobs dependencies'
  );
  
  verify(
    'salaryMax in dependencies',
    /options\.salaryMax/.test(dependencies),
    'options.salaryMax should be in fetchJobs dependencies'
  );
  
  verify(
    'sortBy in dependencies',
    /options\.sortBy/.test(dependencies),
    'options.sortBy should be in fetchJobs dependencies'
  );
  
  verify(
    'sortOrder in dependencies',
    /options\.sortOrder/.test(dependencies),
    'options.sortOrder should be in fetchJobs dependencies'
  );
} else {
  verify(
    'fetchJobs dependencies found',
    false,
    'Could not find fetchJobs useCallback dependencies'
  );
}

// Summary
console.log('\n=== Verification Summary ===');
const passed = results.filter(r => r.passed).length;
const total = results.length;
const percentage = ((passed / total) * 100).toFixed(1);

console.log(`Passed: ${passed}/${total} (${percentage}%)`);

if (passed === total) {
  console.log('\n✓ All checks passed! The useJobs hook is correctly implemented.');
  process.exit(0);
} else {
  console.log('\n✗ Some checks failed. Please review the implementation.');
  console.log('\nFailed checks:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.check}: ${r.details}`);
  });
  process.exit(1);
}
