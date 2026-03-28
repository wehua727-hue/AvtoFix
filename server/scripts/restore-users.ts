import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { User } from '../user.model';
import { connectMongo } from '../mongo';

/**
 * FOYDALANUVCHILARNI TIKLASH SCRIPTI
 * 
 * Agar foydalanuvchilar o'chib ketgan bo'lsa, bu script:
 * 1. Barcha foydalanuvchilarni ko'rsatadi
 * 2. Yangi egani yaratadi (agar yo'q bo'lsa)
 * 3. Mahsulotlarni tiklaydi
 */

async function restoreUsers() {
  try {
    console.log('🔧 [restore-users] Foydalanuvchilarni tiklash boshlandi...');
    console.log('[restore-users] MongoDB ga ulanmoqda...');
    await connectMongo();
    console.log('[restore-users] ✅ MongoDB ga ulandi!');

    // Barcha foydalanuvchilarni ko'rish
    console.log('\n📋 Mavjud foydalanuvchilar:');
    const allUsers = await User.find().select('-password').sort({ createdAt: -1 });
    
    if (allUsers.length === 0) {
      console.log('❌ Hech qanday foydalanuvchi topilmadi!');
    } else {
      console.log(`✅ Jami ${allUsers.length} ta foydalanuvchi topildi:\n`);
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.phone}) - ${user.role}`);
      });
    }

    // Yangi egani yaratish
    console.log('\n🆕 Yangi ega yaratilmoqda...');
    const phone = '914058481';
    const password = '1234567';
    const name = 'Ega';

    const existingUser = await User.findOne({ phone });
    
    if (existingUser) {
      console.log(`⚠️  Telefon raqami ${phone} bilan foydalanuvchi allaqachon mavjud`);
    } else {
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
      console.log(`✅ Yangi ega yaratildi: ${name} (${phone})`);
    }

    // Mahsulotlarni tekshirish
    console.log('\n📦 Mahsulotlarni tekshirish...');
    const { ProductModel } = await import('../product.model');
    const productsWithoutUser = await ProductModel.countDocuments({ userId: { $exists: false } });
    const productsWithUser = await ProductModel.countDocuments({ userId: { $exists: true } });
    
    console.log(`   📊 Jami mahsulotlar: ${productsWithoutUser + productsWithUser}`);
    console.log(`   ✅ Foydalanuvchiga bog'langan: ${productsWithUser}`);
    console.log(`   ⚠️  Foydalanuvchisiz: ${productsWithoutUser}`);

    console.log('\n✅ Tiklash tugadi!');
    console.log('\n📋 Kirish ma\'lumotlari:');
    console.log('   📱 Telefon:', phone);
    console.log('   🔐 Parol:', password);
    console.log('   👑 Rol: Ega (egasi)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ [restore-users] Xato:', error);
    process.exit(1);
  }
}

restoreUsers();
