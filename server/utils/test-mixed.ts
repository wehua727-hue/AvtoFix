/**
 * Aralash alifbo test (Lotin + Kiril)
 */

import { detectAlphabet, latinToCyrillic } from './alphabet-converter';

console.log('=== ARALASH ALIFBO TEST ===\n');

// Test mahsulotlar
const products = [
  'Тормоз колодка',      // Faqat kiril
  'Tormoz kolodka',      // Faqat lotin
  'Двигател maslo',      // Aralash (kiril + lotin)
  'Филтр havo',          // Aralash (kiril + lotin)
  'Шестерня',            // Faqat kiril
  'Chashka',             // Faqat lotin
  'Qopqoq benzin',       // Faqat lotin (Q harfi)
  'Ҳаво filtr',          // Aralash (kiril + lotin)
];

console.log('📋 Mahsulotlar ro\'yxati:\n');

products.forEach((product, index) => {
  const alphabet = detectAlphabet(product);
  const converted = latinToCyrillic(product);
  const changed = product !== converted;
  
  console.log(`${index + 1}. "${product}"`);
  console.log(`   Alifbo: ${alphabet}`);
  console.log(`   Natija: "${converted}"`);
  console.log(`   O'zgardi: ${changed ? '✅ HA' : '❌ YO\'Q'}`);
  console.log('');
});

console.log('\n=== STATISTIKA ===\n');

const stats = {
  latin: 0,
  cyrillic: 0,
  mixed: 0,
  unknown: 0,
};

products.forEach(product => {
  const alphabet = detectAlphabet(product);
  stats[alphabet]++;
});

console.log(`Jami mahsulotlar: ${products.length}`);
console.log(`Faqat lotin: ${stats.latin}`);
console.log(`Faqat kiril: ${stats.cyrillic}`);
console.log(`Aralash: ${stats.mixed}`);
console.log(`Noma'lum: ${stats.unknown}`);
console.log('');

const needsConversion = stats.latin + stats.mixed;
console.log(`Konvertatsiya kerak: ${needsConversion} ta (lotin + aralash)`);
console.log(`Konvertatsiya kerak emas: ${stats.cyrillic} ta (faqat kiril)`);

console.log('\n=== TEST TUGADI ===');
