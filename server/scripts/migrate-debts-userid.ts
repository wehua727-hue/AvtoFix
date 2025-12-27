import 'dotenv/config';
import { connectMongo } from '../mongo';
import { Debt } from '../debt.model';
import { CustomerModel } from '../customer.model';
import { User } from '../user.model';

async function migrateDebtsUserId() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    
    await connectMongo();
    
    console.log('Starting migration...\n');
    
    // Default foydalanuvchini topish (birinchi foydalanuvchi)
    const defaultUser = await User.findOne().sort({ createdAt: 1 });
    
    if (!defaultUser) {
      console.error('No users found! Please create a user first.');
      process.exit(1);
    }
    
    console.log(`Using default user: ${defaultUser.name} (${defaultUser.phone})`);
    console.log(`User ID: ${defaultUser._id}\n`);
    
    // Debts migration
    console.log('Migrating debts...');
    const debtsResult = await Debt.updateMany(
      { 
        $or: [
          { userId: { $exists: false } },
          { userId: null }
        ]
      },
      { $set: { userId: defaultUser._id } }
    );
    
    console.log(`Updated ${debtsResult.modifiedCount} debts\n`);
    
    // Customers migration
    console.log('Migrating customers...');
    const customersResult = await CustomerModel.updateMany(
      { 
        $or: [
          { userId: { $exists: false } },
          { userId: null }
        ]
      },
      { $set: { userId: defaultUser._id } }
    );
    
    console.log(`Updated ${customersResult.modifiedCount} customers\n`);
    
    console.log('Migration completed successfully!');
    console.log(`All old data is now assigned to: ${defaultUser.name}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateDebtsUserId();
