/**
 * MongoDB backup mavjudligini tekshirish
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('========================================');
console.log('MongoDB Backup Tekshirish');
console.log('========================================\n');

// Odatiy backup papkalari
const backupPaths = [
  'C:\\data\\backup',
  'C:\\mongodb\\backup',
  'C:\\backup',
  'C:\\Users\\Public\\backup',
  process.env.USERPROFILE + '\\backup',
  process.env.USERPROFILE + '\\Desktop\\backup',
];

console.log('🔍 Backup papkalarini qidirish...\n');

let foundBackups: string[] = [];

for (const backupPath of backupPaths) {
  if (fs.existsSync(backupPath)) {
    console.log(`✅ Topildi: ${backupPath}`);
    
    // Ichidagi fayllarni ko'rish
    try {
      const files = fs.readdirSync(backupPath);
      if (files.length > 0) {
        console.log(`   Fayllar: ${files.length} ta`);
        files.slice(0, 5).forEach(file => {
          const filePath = path.join(backupPath, file);
          const stats = fs.statSync(filePath);
          const date = stats.mtime.toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
          console.log(`   - ${file} (${date})`);
        });
        foundBackups.push(backupPath);
      }
      console.log('');
    } catch (err) {
      console.log(`   ❌ O'qib bo'lmadi\n`);
    }
  }
}

if (foundBackups.length === 0) {
  console.log('❌ Hech qanday backup topilmadi\n');
  console.log('💡 Backup qidirish uchun:');
  console.log('   1. Windows Explorer ochish');
  console.log('   2. "backup" yoki "mongodb" qidirish');
  console.log('   3. Kechagi (2025-02-16) sanali papkalarni topish\n');
} else {
  console.log('========================================');
  console.log(`✅ ${foundBackups.length} ta backup papka topildi`);
  console.log('========================================\n');
  console.log('📝 Keyingi qadam:');
  console.log('   Backup papkasini ochib, kechagi sanali fayllarni qidiring\n');
}

// MongoDB dump papkasini tekshirish
console.log('🔍 MongoDB dump papkasini tekshirish...\n');
try {
  const result = execSync('where mongodump', { encoding: 'utf-8' });
  console.log('✅ mongodump topildi:', result.trim());
  console.log('\n💡 Backup olish uchun:');
  console.log('   mongodump --db avtofix --out C:\\backup\\$(date +%Y%m%d)\n');
} catch {
  console.log('❌ mongodump topilmadi\n');
  console.log('💡 MongoDB Tools o\'rnatish kerak:\n');
  console.log('   https://www.mongodb.com/try/download/database-tools\n');
}
