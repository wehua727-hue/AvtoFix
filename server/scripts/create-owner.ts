import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { User } from '../user.model';
import { connectMongo } from '../mongo';

/**
 * YANGI EGA YARATISH SCRIPTI
 * 
 * Ishlatish:
 * pnpm run create-owner
 * 
 * Bu script:
 * 1. Telefon raqami 914058481 bilan yangi egani yaratadi
 * 2. Parol: 1234567
 * 3. Agar foydalanuvchi mavjud bo'lsa, parolni yangilaydi
 * 4. Yangi do'kon yaratadi
 */

async function createOwner() {
  try {
    console.log('🚀 [create-owner] Egani yaratish boshlandi...');
    console.log('[create-owner] MongoDB URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Not set');
    console.log('[create-owner] DB Name:', process.env.DB_NAME);
    
    console.log('[create-owner] MongoDB ga ulanmoqda...');
    await connectMongo();
    console.log('[create-owner] ✅ MongoDB ga ulandi!');

    const phone = '914058481';
    const password = '1234567';
    const name = 'Ega';

    // Tekshirish - foydalanuvchi mavjudmi?
    console.log(`[create-owner] Telefon raqami ${phone} bilan foydalanuvchi qidirilmoqda...`);
    const existingUser = await User.findOne({ phone });
    
    if (existingUser) {
      console.log('⚠️  [create-owner] Foydalanuvchi allaqachon mavjud:');
      console.log('   📱 Telefon:', existingUser.phone);
      console.log('   👤 Ism:', existingUser.name);
      console.log('   👑 Rol:', existingUser.role);
      
      // Parolni yangilash
      console.log('[create-owner] Parol yangilanmoqda...');
      const hashedPassword = await bcrypt.hash(password, 10);
      existingUser.password = hashedPassword;
      await existingUser.save();
      console.log('✅ [create-owner] Parol yangilandi!');
      
      console.log('\n📋 Kirish ma\'lumotlari:');
      console.log('   📱 Telefon:', phone);
      console.log('   🔐 Parol:', password);
      console.log('   👑 Rol: Ega (egasi)');
      
      process.exit(0);
      return;
    }

    // Yangi foydalanuvchi yaratish
    console.log('[create-owner] Yangi ega yaratilmoqda...');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      name,
      phone,
      password: hashedPassword,
      role: 'egasi',
      address: 'Toshkent',
      subscriptionType: 'cheksiz',
    });

    await newUser.save();
    
    console.log('✅ [create-owner] Ega muvaffaqiyatli yaratildi!');
    console.log('\n📋 Kirish ma\'lumotlari:');
    console.log('   📱 Telefon:', phone);
    console.log('   🔐 Parol:', password);
    console.log('   👑 Rol: Ega (egasi)');
    console.log('   🆔 ID:', newUser._id.toString());
    console.log('   📅 Yaratilgan:', new Date().toLocaleString('uz-UZ'));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ [create-owner] Xato:', error);
    process.exit(1);
  }
}

createOwner();
