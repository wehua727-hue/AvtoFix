import 'dotenv/config';
import { OrderModel } from '../order.model';
import { CustomerModel } from '../customer.model';
import { connectMongo } from '../mongo';

async function createTestOrders() {
  try {
    console.log('[test-orders] Connecting to MongoDB...');
    await connectMongo();
    console.log('[test-orders] Connected!');

    // Test mijozlar
    const testCustomers = [
      { phone: '901234567', name: 'Ali Valiyev' },
      { phone: '902345678', name: 'Vali Aliyev' },
      { phone: '903456789', name: 'Sardor Karimov' },
    ];

    // Har bir mijoz uchun 5 ta buyurtma yaratish
    for (const customer of testCustomers) {
      console.log(`\n[test-orders] Creating orders for ${customer.name}...`);
      
      for (let i = 1; i <= 5; i++) {
        const order = new OrderModel({
          customerPhone: customer.phone,
          customerName: customer.name,
          items: [
            {
              productId: 'test-product-1',
              productName: 'Avtomobil ehtiyot qismi',
              quantity: Math.floor(Math.random() * 3) + 1,
              price: Math.floor(Math.random() * 100000) + 50000,
            }
          ],
          totalAmount: Math.floor(Math.random() * 300000) + 100000,
          status: 'completed',
          notes: `Test buyurtma #${i}`,
        });

        await order.save();
        console.log(`  ✓ Order ${i} created`);

        // Mijozni yangilash
        let existingCustomer = await CustomerModel.findOne({ phone: customer.phone });
        
        if (existingCustomer) {
          existingCustomer.totalOrders = (existingCustomer.totalOrders || 0) + 1;
          existingCustomer.totalSpent = (existingCustomer.totalSpent || 0) + order.totalAmount;
          existingCustomer.lastOrderDate = new Date();
          await existingCustomer.save();
        } else {
          const [firstName, ...lastNameParts] = customer.name.split(' ');
          const lastName = lastNameParts.join(' ') || 'VIP';
          
          existingCustomer = new CustomerModel({
            firstName,
            lastName,
            phone: customer.phone,
            birthDate: new Date('2000-01-01'), // Default sana
            notes: 'Test mijoz (avtomatik yaratilgan)',
            totalOrders: 1,
            totalSpent: order.totalAmount,
            lastOrderDate: new Date(),
          });
          
          await existingCustomer.save();
          console.log(`  ✓ Customer created: ${customer.name}`);
        }
      }
      
      console.log(`✓ ${customer.name}: 5 ta buyurtma yaratildi`);
    }

    console.log('\n[test-orders] ✅ Barcha test buyurtmalar yaratildi!');
    console.log('\nMijozlar sahifasiga o\'ting va VIP mijozlar eslatmasini ko\'ring!');
    
    process.exit(0);
  } catch (error) {
    console.error('[test-orders] Error:', error);
    process.exit(1);
  }
}

createTestOrders();
