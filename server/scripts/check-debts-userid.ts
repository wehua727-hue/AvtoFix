import 'dotenv/config';
import { connectMongo } from '../mongo';
import { Debt } from '../debt.model';
import { CustomerModel } from '../customer.model';

async function checkDebtsUserId() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    
    await connectMongo();
    
    console.log('Checking debts without userId...');
    
    const debtsWithoutUserId = await Debt.find({ 
      $or: [
        { userId: { $exists: false } },
        { userId: null }
      ]
    });
    
    console.log(`Found ${debtsWithoutUserId.length} debts without userId`);
    
    if (debtsWithoutUserId.length > 0) {
      console.log('\nDebts without userId:');
      debtsWithoutUserId.forEach(debt => {
        console.log(`- ID: ${debt._id}, Creditor: ${debt.creditor}, Amount: ${debt.amount}`);
      });
    }
    
    console.log('\n---\n');
    
    console.log('Checking customers without userId...');
    
    const customersWithoutUserId = await CustomerModel.find({ 
      $or: [
        { userId: { $exists: false } },
        { userId: null }
      ]
    });
    
    console.log(`Found ${customersWithoutUserId.length} customers without userId`);
    
    if (customersWithoutUserId.length > 0) {
      console.log('\nCustomers without userId:');
      customersWithoutUserId.forEach(customer => {
        console.log(`- ID: ${customer._id}, Name: ${customer.firstName} ${customer.lastName}`);
      });
    }
    
    console.log('\nDone!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDebtsUserId();
