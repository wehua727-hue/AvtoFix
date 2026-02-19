/**
 * Alphabet converter test script
 * Run: npx tsx server/utils/test-alphabet-converter.ts
 */

import {
  hasLatinLetters,
  hasCyrillicLetters,
  detectAlphabet,
  latinToCyrillic,
  convertProductName,
} from './alphabet-converter';

console.log('=== ALPHABET CONVERTER TEST ===\n');

// Test 1: Lotin harflarni aniqlash
console.log('Test 1: Lotin harflarni aniqlash');
console.log('hasLatinLetters("Maslo"):', hasLatinLetters("Maslo")); // true
console.log('hasLatinLetters("Масло"):', hasLatinLetters("Масло")); // false
console.log('hasLatinLetters("123"):', hasLatinLetters("123")); // false
console.log('hasLatinLetters("Maslo 123"):', hasLatinLetters("Maslo 123")); // true
console.log();

// Test 2: Kiril harflarni aniqlash
console.log('Test 2: Kiril harflarni aniqlash');
console.log('hasCyrillicLetters("Масло"):', hasCyrillicLetters("Масло")); // true
console.log('hasCyrillicLetters("Maslo"):', hasCyrillicLetters("Maslo")); // false
console.log('hasCyrillicLetters("123"):', hasCyrillicLetters("123")); // false
console.log('hasCyrillicLetters("Масло 123"):', hasCyrillicLetters("Масло 123")); // true
console.log();

// Test 3: Alifboni aniqlash
console.log('Test 3: Alifboni aniqlash');
console.log('detectAlphabet("Maslo"):', detectAlphabet("Maslo")); // latin
console.log('detectAlphabet("Масло"):', detectAlphabet("Масло")); // cyrillic
console.log('detectAlphabet("Dvigatel maslo"):', detectAlphabet("Dvigatel maslo")); // mixed
console.log('detectAlphabet("123"):', detectAlphabet("123")); // unknown
console.log();

// Test 4: Lotin → Kiril konvertatsiya
console.log('Test 4: Lotin → Kiril konvertatsiya');
const testCases = [
  { input: "Maslo", expected: "Масло" },
  { input: "Filtr", expected: "Филтр" },
  { input: "Shina", expected: "Шина" },
  { input: "Zadning pavarot", expected: "Задниң паварот" },
  { input: "Dvigatel maslo", expected: "Двигател масло" },
  { input: "Filtr havo", expected: "Филтр ҳаво" },
  { input: "Maslo 5W-40", expected: "Масло 5W-40" },
  { input: "Filtr (havo)", expected: "Филтр (ҳаво)" },
  { input: "Shina 195/65R15", expected: "Шина 195/65Р15" },
  { input: "Maslo 123", expected: "Масло 123" },
  { input: "Chiroq", expected: "Чироқ" },
  { input: "Yoqilg'i", expected: "Йоқилғ'и" },
];

testCases.forEach(({ input, expected }) => {
  const result = latinToCyrillic(input);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} "${input}" → "${result}" (expected: "${expected}")`);
});
console.log();

// Test 5: Mahsulot nomini konvertatsiya qilish
console.log('Test 5: Mahsulot nomini konvertatsiya qilish');
console.log('convertProductName("Maslo"):', convertProductName("Maslo"));
console.log('convertProductName("Масло"):', convertProductName("Масло")); // o'zgarmaydi
console.log('convertProductName("Dvigatel maslo"):', convertProductName("Dvigatel maslo"));
console.log();

// Test 6: Maxsus belgilar va raqamlar
console.log('Test 6: Maxsus belgilar va raqamlar');
const specialCases = [
  "Maslo 5W-40",
  "Filtr (havo)",
  "Shina 195/65R15",
  "Kod: ABC-123",
  "Narx: 150000 so'm",
];

specialCases.forEach(input => {
  const result = latinToCyrillic(input);
  console.log(`"${input}" → "${result}"`);
});
console.log();

// Test 7: Ikki harfli kombinatsiyalar
console.log('Test 7: Ikki harfli kombinatsiyalar (sh, ch, yo, yu, ya)');
const digraphCases = [
  { input: "Shina", expected: "Шина" },
  { input: "Chiroq", expected: "Чироқ" },
  { input: "Yoqilg'i", expected: "Йоқилғ'и" },
  { input: "Yulduz", expected: "Йулдуз" },
  { input: "Yashil", expected: "Йашил" },
];

digraphCases.forEach(({ input, expected }) => {
  const result = latinToCyrillic(input);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} "${input}" → "${result}" (expected: "${expected}")`);
});
console.log();

console.log('=== TEST YAKUNLANDI ===');
