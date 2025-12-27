import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { User } from '../user.model';
import { connectMongo } from '../mongo';

async function createAdminUser() {
  try {
    console.log('[create-admin] MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    console.log('[create-admin] DB Name:', process.env.DB_NAME);
    console.log('[create-admin] Connecting to MongoDB...');
    await connectMongo();
    console.log('[create-admin] Connected!');

    const phone = '910712828';
    const password = '123456';
    const name = 'Admin';

    // Tekshirish - foydalanuvchi mavjudmi?
    const existingUser = await User.findOne({ phone });
    
    if (existingUser) {
      console.log('[create-admin] User already exists:', {
        phone: existingUser.phone,
        name: existingUser.name,
        role: existingUser.role,
      });
      
      // Parolni yangilash
      const hashedPassword = await bcrypt.hash(password, 10);
      existingUser.password = hashedPassword;
      await existingUser.save();
      console.log('[create-admin] Password updated!');
      return;
    }

    // Yangi foydalanuvchi yaratish
    console.log('[create-admin] Creating new user...');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      name,
      phone,
      password: hashedPassword,
      role: 'owner',
      address: 'Toshkent',
    });

    await newUser.save();
    
    console.log('[create-admin] User created successfully!');
    console.log('[create-admin] Login credentials:');
    console.log('  Phone:', phone);
    console.log('  Password:', password);
    console.log('  Role:', 'owner');
    
    process.exit(0);
  } catch (error) {
    console.error('[create-admin] Error:', error);
    process.exit(1);
  }
}

createAdminUser();
