/**
 * Simple test script for vocabulary processing functions
 */

// Test Fijian word validation
function isValidFijianWord(word: string): boolean {
  // Basic validation for Fijian phonology
  // Fijian typically uses: a, e, i, o, u, b, c, d, f, g, j, k, l, m, n, p, q, r, s, t, v, w, y
  const fijianPattern = /^[abcdefgijklmnpqrstuvwy]+$/i;
  
  return word.length >= 2 && 
         word.length <= 20 && 
         fijianPattern.test(word) &&
         /[aeiou]/i.test(word); // Must contain at least one vowel
}

// Test tokenization
function tokenizeFijianText(text: string): string[] {
  // Split on whitespace and punctuation, clean up
  const words = text
    .toLowerCase()
    .split(/[\s\p{P}]+/u) // Split on Unicode punctuation and whitespace
    .map(word => word.trim())
    .filter(word => word.length > 0)
    .filter(isValidFijianWord);
  
  return words;
}

console.log('=== Testing Fijian Word Validation ===');
const testWords = [
  'bula', // valid - common greeting
  'vinaka', // valid - thank you
  'vakacava', // valid - how
  'xyz', // invalid - no vowels
  'a', // invalid - too short
  'abcdefghijklmnopqrstuvwxyz', // invalid - too long
  'hello', // invalid - contains 'h' not in Fijian
  'tabu', // valid - sacred/forbidden
  'kava', // valid - traditional drink
];

testWords.forEach(word => {
  const isValid = isValidFijianWord(word);
  console.log(`${word}: ${isValid ? '✓' : '✗'}`);
});

// Test tokenization
console.log('\n=== Testing Tokenization ===');
const testText = "Bula vinaka! Na kava sa yawa sara. Vakacava?";
const tokens = tokenizeFijianText(testText);
console.log('Original text:', testText);
console.log('Tokens:', tokens);

console.log('\n=== Test Complete ===');