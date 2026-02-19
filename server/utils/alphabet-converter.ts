/**
 * O'zbek lotin va kiril alifbosi o'rtasida konvertatsiya qilish
 */

// O'zbek lotin → kiril mapping (to'liq)
const LATIN_TO_CYRILLIC_MAP: Record<string, string> = {
  // Katta harflar
  'A': 'А', 'B': 'Б', 'D': 'Д', 'E': 'Е', 'F': 'Ф', 'G': 'Г', 'H': 'Ҳ',
  'I': 'И', 'J': 'Ж', 'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н', 'O': 'О',
  'P': 'П', 'Q': 'Қ', 'R': 'Р', 'S': 'С', 'T': 'Т', 'U': 'У', 'V': 'В',
  'X': 'Х', 'Y': 'Й', 'Z': 'З',
  
  // Kichik harflar
  'a': 'а', 'b': 'б', 'd': 'д', 'e': 'е', 'f': 'ф', 'g': 'г', 'h': 'ҳ',
  'i': 'и', 'j': 'ж', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
  'p': 'п', 'q': 'қ', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'v': 'в',
  'x': 'х', 'y': 'й', 'z': 'з',
};

// Ikki harfli kombinatsiyalar (avval tekshiriladi)
const DIGRAPH_MAP: Record<string, string> = {
  // Katta harflar
  'Sh': 'Ш',
  'SH': 'Ш',
  'Ch': 'Ч',
  'CH': 'Ч',
  'Yo': 'Ё',
  'YO': 'Ё',
  'Yu': 'Ю',
  'YU': 'Ю',
  'Ya': 'Я',
  'YA': 'Я',
  'Ye': 'Е',
  'YE': 'Е',
  
  // Kichik harflar
  'sh': 'ш',
  'ch': 'ч',
  'yo': 'ё',
  'yu': 'ю',
  'ya': 'я',
  'ye': 'е',
};

/**
 * Matnda lotin harflari borligini tekshirish
 */
export function hasLatinLetters(text: string): boolean {
  if (!text) return false;
  
  // Lotin alifbosiga xos harflar (raqam va maxsus belgilar emas)
  const latinPattern = /[a-zA-Z]/;
  return latinPattern.test(text);
}

/**
 * Matnda kiril harflari borligini tekshirish
 */
export function hasCyrillicLetters(text: string): boolean {
  if (!text) return false;
  
  // Kiril alifbosiga xos harflar
  const cyrillicPattern = /[а-яА-ЯёЁўЎқҚғҒҳҲ]/;
  return cyrillicPattern.test(text);
}

/**
 * Matn qaysi alifboda ekanligini aniqlash
 * Faqat BIRINCHI SO'ZGA qarab aniqlaydi
 * @returns 'latin' | 'cyrillic' | 'mixed' | 'unknown'
 */
export function detectAlphabet(text: string): 'latin' | 'cyrillic' | 'mixed' | 'unknown' {
  if (!text) return 'unknown';
  
  // Birinchi so'zni ajratib olish (bo'sh joy, tire, nuqta bilan ajratilgan)
  const firstWord = text.trim().split(/[\s\-\.]+/)[0];
  
  if (!firstWord) return 'unknown';
  
  const hasLatin = hasLatinLetters(firstWord);
  const hasCyrillic = hasCyrillicLetters(firstWord);
  
  if (hasLatin && hasCyrillic) return 'mixed';
  if (hasLatin) return 'latin';
  if (hasCyrillic) return 'cyrillic';
  
  return 'unknown';
}

/**
 * Lotin matnini kirilga o'girish
 */
export function latinToCyrillic(text: string): string {
  if (!text) return text;
  
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    let converted = false;
    
    // Avval ikki harfli kombinatsiyalarni tekshirish
    if (i < text.length - 1) {
      const twoChar = text.substring(i, i + 2);
      if (DIGRAPH_MAP[twoChar]) {
        result += DIGRAPH_MAP[twoChar];
        i += 2;
        converted = true;
      }
    }
    
    // Agar ikki harfli topilmasa, bitta harfni tekshirish
    if (!converted) {
      const oneChar = text[i];
      if (LATIN_TO_CYRILLIC_MAP[oneChar]) {
        result += LATIN_TO_CYRILLIC_MAP[oneChar];
      } else {
        // Agar mapping da yo'q bo'lsa (raqam, belgi), o'zini qo'shish
        result += oneChar;
      }
      i++;
    }
  }
  
  return result;
}

/**
 * Mahsulot nomini lotin alifbosidan kirilga o'girish
 * Faqat lotin harflarini o'zgartiradi, raqam va boshqa belgilarni saqlab qoladi
 */
export function convertProductName(name: string): string {
  if (!name) return name;
  
  // Agar matn allaqachon kirilga o'girilgan bo'lsa, o'zgartirmaslik
  const alphabet = detectAlphabet(name);
  if (alphabet === 'cyrillic') {
    return name;
  }
  
  // Lotindan kirilga o'girish
  return latinToCyrillic(name);
}

/**
 * Mahsulot obyektini konvertatsiya qilish (nom va variantlar)
 */
export function convertProductToCyrillic(product: any): any {
  if (!product) return product;
  
  const converted = { ...product };
  
  // Asosiy mahsulot nomini o'girish
  if (converted.name) {
    converted.originalLatinName = converted.name; // Asl nomini saqlash
    converted.name = convertProductName(converted.name);
  }
  
  // Variantlarni o'girish
  if (Array.isArray(converted.variants)) {
    converted.variants = converted.variants.map((variant: any) => ({
      ...variant,
      originalLatinName: variant.name,
      name: convertProductName(variant.name),
    }));
  }
  
  return converted;
}
