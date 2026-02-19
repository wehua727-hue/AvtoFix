/**
 * Alphabet Converter Test
 * Bu faylni node bilan ishga tushiring: node alphabet-converter.test.ts
 */

import { 
  hasLatinLetters, 
  hasCyrillicLetters, 
  detectAlphabet, 
  latinToCyrillic,
  convertProductName 
} from './alphabet-converter';

console.log('=== ALPHABET CONVERTER TEST ===\n');

// Test 1: Lotin harflarni aniqlash
console.log('Test 1: Lotin harflarni aniqlash');
console.log('hasLatinLetters("Tormoz"): ', hasLatinLetters('Tormoz')); // true
console.log('hasLatinLetters("Тормоз"): ', hasLatinLetters('Тормоз')); // false
console.log('hasLatinLetters("12345"): ', hasLatinLetters('12345')); // false
console.log('');

// Test 2: Kiril harflarni aniqlash
console.log('Test 2: Kiril harflarni aniqlash');
console.log('hasCyrillicLetters("Tormoz"): ', hasCyrillicLetters('Tormoz')); // false
console.log('hasCyrillicLetters("Тормоз"): ', hasCyrillicLetters('Тормоз')); // true
console.log('hasCyrillicLetters("12345"): ', hasCyrillicLetters('12345')); // false
console.log('');

// Test 3: Alifboni aniqlash
console.log('Test 3: Alifboni aniqlash');
console.log('detectAlphabet("Tormoz"): ', detectAlphabet('Tormoz')); // latin
console.log('detectAlphabet("Тормоз"): ', detectAlphabet('Тормоз')); // cyrillic
console.log('detectAlphabet("Tormoz Тормоз"): ', detectAlphabet('Tormoz Тормоз')); // mixed
console.log('detectAlphabet("12345"): ', detectAlphabet('12345')); // unknown
console.log('');

// Test 4: Oddiy lotin → kiril
console.log('Test 4: Oddiy lotin → kiril');
console.log('latinToCyrillic("Tormoz"): ', latinToCyrillic('Tormoz'));
console.log('latinToCyrillic("Dvigatel"): ', latinToCyrillic('Dvigatel'));
console.log('latinToCyrillic("Filtr"): ', latinToCyrillic('Filtr'));
console.log('');

// Test 5: Maxsus harflar
console.log('Test 5: Maxsus harflar (Q, H)');
console.log('latinToCyrillic("Qopqoq"): ', latinToCyrillic('Qopqoq')); // Қопқоқ
console.log('latinToCyrillic("Havo"): ', latinToCyrillic('Havo')); // Ҳаво
console.log('');

// Test 6: Ikki harfli kombinatsiyalar
console.log('Test 6: Ikki harfli kombinatsiyalar (Sh, Ch, Yo, Yu, Ya)');
console.log('latinToCyrillic("Shesternya"): ', latinToCyrillic('Shesternya')); // Шестерня
console.log('latinToCyrillic("Chashka"): ', latinToCyrillic('Chashka')); // Чашка
console.log('latinToCyrillic("Yoqilgi"): ', latinToCyrillic('Yoqilgi')); // Ёқилги (agar Yo bor bo'lsa)
console.log('');

// Test 7: Aralash (lotin + raqam + belgi)
console.log('Test 7: Aralash (lotin + raqam + belgi)');
console.log('latinToCyrillic("Filtr 12345"): ', latinToCyrillic('Filtr 12345'));
console.log('latinToCyrillic("Tormoz-kolodka"): ', latinToCyrillic('Tormoz-kolodka'));
console.log('latinToCyrillic("Dvigatel (benzin)"): ', latinToCyrillic('Dvigatel (benzin)'));
console.log('');

// Test 8: Mahsulot nomlari
console.log('Test 8: Mahsulot nomlari');
console.log('convertProductName("Tormoz kolodka"): ', convertProductName('Tormoz kolodka'));
console.log('convertProductName("Dvigatel maslo"): ', convertProductName('Dvigatel maslo'));
console.log('convertProductName("Filtr havo"): ', convertProductName('Filtr havo'));
console.log('convertProductName("Shesternya chashka"): ', convertProductName('Shesternya chashka'));
console.log('');

// Test 9: Allaqachon kirilga o'girilgan
console.log('Test 9: Allaqachon kirilga o\'girilgan (o\'zgarmaydi)');
console.log('convertProductName("Тормоз колодка"): ', convertProductName('Тормоз колодка'));
console.log('');

// Test 10: Katta-kichik harflar
console.log('Test 10: Katta-kichik harflar');
console.log('latinToCyrillic("TORMOZ"): ', latinToCyrillic('TORMOZ'));
console.log('latinToCyrillic("tormoz"): ', latinToCyrillic('tormoz'));
console.log('latinToCyrillic("Tormoz"): ', latinToCyrillic('Tormoz'));
console.log('');

console.log('=== BARCHA TESTLAR TUGADI ===');
