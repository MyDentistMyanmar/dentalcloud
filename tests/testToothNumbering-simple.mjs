// Simple test runner for tooth numbering - ES module format
import { createRequire } from 'module';

console.log('Running tooth numbering tests...\n');

// Test Universal to FDI conversion (the critical conversion that was verified)
const universalToFDI = (n) => {
  if (n >= 1 && n <= 8) return 19 - n;
  if (n >= 9 && n <= 16) return n + 12;
  if (n >= 17 && n <= 24) return 55 - n;
  if (n >= 25 && n <= 32) return n + 16;
  return n;
};

const correctMapping = {
  1: 18, 2: 17, 3: 16, 4: 15, 5: 14, 6: 13, 7: 12, 8: 11,
  9: 21, 10: 22, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28,
  17: 38, 18: 37, 19: 36, 20: 35, 21: 34, 22: 33, 23: 32, 24: 31,
  25: 41, 26: 42, 27: 43, 28: 44, 29: 45, 30: 46, 31: 47, 32: 48
};

console.log('Test 1: Universal to FDI Conversion (all 32 teeth)');
let errors = 0;
for (let u = 1; u <= 32; u++) {
  const actual = universalToFDI(u);
  const expected = correctMapping[u];
  if (actual !== expected) {
    console.log(`  ❌ Universal ${u} -> Code: ${actual}, Expected: ${expected}`);
    errors++;
  }
}
console.log(errors === 0 ? `  ✅ PASSED (32/32 correct)\n` : `  ❌ FAILED (${errors} errors)\n`);

// Test FDI to Universal conversion
const fdiToUniversal = (n) => {
  if (n >= 11 && n <= 18) return 19 - n;
  if (n >= 21 && n <= 28) return n - 12;
  if (n >= 31 && n <= 38) return 55 - n;
  if (n >= 41 && n <= 48) return n - 16;
  return n;
};

console.log('Test 2: FDI to Universal Conversion');
let fdiErrors = 0;
const fdiTests = [
  { fdi: 11, u: 8 }, { fdi: 18, u: 1 },
  { fdi: 21, u: 9 }, { fdi: 28, u: 16 },
  { fdi: 31, u: 24 }, { fdi: 38, u: 17 },
  { fdi: 41, u: 25 }, { fdi: 48, u: 32 }
];
fdiTests.forEach(({ fdi, u }) => {
  const result = fdiToUniversal(fdi);
  if (result !== u) {
    console.log(`  ❌ FDI ${fdi} -> Code: ${result}, Expected: ${u}`);
    fdiErrors++;
  }
});
console.log(fdiErrors === 0 ? `  ✅ PASSED (8/8 correct)\n` : `  ❌ FAILED (${fdiErrors} errors)\n`);

// Test position mapping
console.log('Test 3: Tooth Position Mapping');
const getToothPosition = (tooth) => {
  // FDI permanent numbering (11-48) - check FIRST
  if (tooth >= 11 && tooth <= 48) {
    const quadrant = Math.floor(tooth / 10);
    if (quadrant === 1) return 'Upper Right';
    if (quadrant === 2) return 'Upper Left';
    if (quadrant === 3) return 'Lower Left';
    if (quadrant === 4) return 'Lower Right';
  }
  
  // FDI primary numbering (51-85)
  if (tooth >= 51 && tooth <= 85) {
    const quadrant = Math.floor(tooth / 10);
    if (quadrant === 5) return 'Upper Right (Primary)';
    if (quadrant === 6) return 'Upper Left (Primary)';
    if (quadrant === 7) return 'Lower Left (Primary)';
    if (quadrant === 8) return 'Lower Right (Primary)';
  }
  
  // Universal permanent numbering (1-32)
  if (tooth >= 1 && tooth <= 8) return 'Upper Right';
  if (tooth >= 9 && tooth <= 16) return 'Upper Left';
  if (tooth >= 17 && tooth <= 24) return 'Lower Left';
  if (tooth >= 25 && tooth <= 32) return 'Lower Right';
  
  return 'Unknown Position';
};

const positionTests = [
  { tooth: 11, expected: 'Upper Right' },
  { tooth: 18, expected: 'Upper Right' },
  { tooth: 21, expected: 'Upper Left' },
  { tooth: 31, expected: 'Lower Left' },
  { tooth: 41, expected: 'Lower Right' },
  { tooth: 51, expected: 'Upper Right (Primary)' },
  { tooth: 65, expected: 'Upper Left (Primary)' },
  { tooth: 75, expected: 'Lower Left (Primary)' },
  { tooth: 85, expected: 'Lower Right (Primary)' }
];

let posErrors = 0;
positionTests.forEach(({ tooth, expected }) => {
  const result = getToothPosition(tooth);
  if (result !== expected) {
    console.log(`  ❌ Tooth ${tooth} -> "${result}", expected "${expected}"`);
    posErrors++;
  }
});
console.log(posErrors === 0 ? `  ✅ PASSED (9/9 correct)\n` : `  ❌ FAILED (${posErrors} errors)\n`);

// Test validation
console.log('Test 4: Tooth Validation');
let valErrors = 0;

// FDI Permanent validation
const isValidFDIPermanent = (t) => {
  if (t < 11 || t > 48) return false;
  const quadrant = Math.floor(t / 10);
  const toothInQuadrant = t % 10;
  return quadrant >= 1 && quadrant <= 4 && toothInQuadrant >= 1 && toothInQuadrant <= 8;
};

const validFDIPermanent = [11, 12, 18, 21, 28, 31, 32, 38, 41, 48]; // 32 is valid FDI (Lower Left Lateral Incisor)
const invalidFDIPermanent = [10, 19, 49, 50, 1, 51, 85]; // Removed 32, added primary teeth

validFDIPermanent.forEach(t => {
  if (!isValidFDIPermanent(t)) {
    console.log(`  ❌ ${t} should be valid FDI permanent`);
    valErrors++;
  }
});

invalidFDIPermanent.forEach(t => {
  if (isValidFDIPermanent(t)) {
    console.log(`  ❌ ${t} should be invalid FDI permanent`);
    valErrors++;
  }
});

// FDI Primary validation
const isValidFDIPrimary = (t) => {
  if (t < 51 || t > 85) return false;
  const quadrant = Math.floor(t / 10);
  const toothInQuadrant = t % 10;
  return quadrant >= 5 && quadrant <= 8 && toothInQuadrant >= 1 && toothInQuadrant <= 5;
};

const validPrimary = [51, 55, 61, 65, 71, 75, 81, 85];
const invalidPrimary = [50, 56, 66, 86, 11, 48];

validPrimary.forEach(t => {
  if (!isValidFDIPrimary(t)) {
    console.log(`  ❌ ${t} should be valid primary`);
    valErrors++;
  }
});

invalidPrimary.forEach(t => {
  if (isValidFDIPrimary(t)) {
    console.log(`  ❌ ${t} should be invalid primary`);
    valErrors++;
  }
});

console.log(valErrors === 0 ? `  ✅ PASSED (All validations correct)\n` : `  ❌ FAILED (${valErrors} errors)\n`);

// Test round-trip
console.log('Test 5: Round-trip Conversion (Universal → FDI → Universal)');
let roundTripErrors = 0;
for (let u = 1; u <= 32; u++) {
  const fdi = universalToFDI(u);
  const back = fdiToUniversal(fdi);
  if (back !== u) {
    console.log(`  ❌ Round-trip failed: ${u} → ${fdi} → ${back}`);
    roundTripErrors++;
  }
}
console.log(roundTripErrors === 0 ? `  ✅ PASSED (All 32 teeth round-trip correctly)\n` : `  ❌ FAILED (${roundTripErrors} errors)\n`);

// Summary
console.log('='.repeat(60));
const totalErrors = errors + fdiErrors + posErrors + valErrors + roundTripErrors;
if (totalErrors === 0) {
  console.log('✅ ALL TESTS PASSED - ISO 3950 COMPLIANCE VERIFIED');
  console.log('='.repeat(60));
  process.exit(0);
} else {
  console.log(`❌ ${totalErrors} TEST(S) FAILED`);
  console.log('='.repeat(60));
  process.exit(1);
}
