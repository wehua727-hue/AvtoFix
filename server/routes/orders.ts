import { Request, Response } from "express";
import { OrderModel } from "../order.model";
import { CustomerModel } from "../customer.model";
import { connectMongo } from "../mongo";
import { wsManager } from "../websocket";

// Get all orders
export async function handleOrdersGet(req: Request, res: Response) {
  try {
    await connectMongo();
    const orders = await OrderModel.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error: any) {
    console.error("[orders] Get error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Create order
export async function handleOrderCreate(req: Request, res: Response) {
  try {
    await connectMongo();
    const { customerPhone, customerName, items, totalAmount, notes } = req.body;

    if (!customerPhone || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Telefon raqam va mahsulotlar majburiy",
      });
    }

    const order = new OrderModel({
      customerPhone,
      customerName,
      items,
      totalAmount,
      status: 'completed',
      notes,
    });

    await order.save();

    // Mijozni yangilash yoki yaratish
    await updateOrCreateCustomer(customerPhone, customerName, totalAmount);

    // Broadcast order creation via WebSocket
    const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
    if (userId) {
      wsManager.broadcastToUser(String(userId), {
        type: 'order-created',
        orderId: order._id.toString(),
        total: totalAmount,
        userId: String(userId),
        timestamp: Date.now(),
      });
    } else {
      wsManager.broadcast({
        type: 'order-created',
        orderId: order._id.toString(),
        total: totalAmount,
        timestamp: Date.now(),
      });
    }

    res.json({ success: true, order });
  } catch (error: any) {
    console.error("[orders] Create error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Update customer statistics
async function updateOrCreateCustomer(
  phone: string,
  name: string | undefined,
  amount: number
) {
  try {
    // Mijozni topish
    let customer = await CustomerModel.findOne({ phone });

    if (customer) {
      // Mavjud mijozni yangilash
      customer.totalOrders = (customer.totalOrders || 0) + 1;
      customer.totalSpent = (customer.totalSpent || 0) + amount;
      customer.lastOrderDate = new Date();
      await customer.save();
      console.log(`[orders] Updated customer: ${phone}, orders: ${customer.totalOrders}`);
    } else {
      // Yangi mijoz yaratish (faqat telefon bilan)
      // Tug'ilgan kun keyinchalik qo'shiladi
      const firstName = name ? name.split(' ')[0] : 'Mijoz';
      const lastName = name ? name.split(' ').slice(1).join(' ') || 'VIP' : phone.slice(-4);
      
      customer = new CustomerModel({
        firstName,
        lastName,
        phone,
        birthDate: new Date('2000-01-01'), // Default sana
        notes: 'Avtomatik yaratilgan (buyurtma orqali)',
        totalOrders: 1,
        totalSpent: amount,
        lastOrderDate: new Date(),
      });
      
      await customer.save();
      console.log(`[orders] Created new customer: ${phone}`);
    }
  } catch (error) {
    console.error("[orders] Error updating customer:", error);
  }
}

// Get frequent customers (3+ orders)
export async function handleFrequentCustomers(req: Request, res: Response) {
  try {
    await connectMongo();

    // Aggregate orders by customer phone
    const frequentCustomers = await OrderModel.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: '$customerPhone',
          name: { $first: '$customerName' },
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          lastOrderDate: { $max: '$createdAt' },
        }
      },
      {
        $match: { orderCount: { $gte: 3 } } // 3+ buyurtma
      },
      {
        $sort: { orderCount: -1 }
      }
    ]);

    // Check if they are already customers
    const customersWithStatus = await Promise.all(
      frequentCustomers.map(async (fc) => {
        const existingCustomer = await CustomerModel.findOne({ phone: fc._id });
        return {
          phone: fc._id,
          name: fc.name,
          orderCount: fc.orderCount,
          totalSpent: fc.totalSpent,
          lastOrderDate: fc.lastOrderDate,
          isCustomer: !!existingCustomer,
          customer: existingCustomer,
        };
      })
    );

    res.json({ success: true, frequentCustomers: customersWithStatus });
  } catch (error: any) {
    console.error("[orders] Frequent customers error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Auto-promote frequent customers to VIP
export async function handleAutoPromoteCustomers(req: Request, res: Response) {
  try {
    await connectMongo();
    
    const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID kerak' });
    }

    // Find only this user's customers with 5+ orders who don't have birthdate set
    const customers = await CustomerModel.find({
      userId,
      totalOrders: { $gte: 5 },
      birthDate: new Date('2000-01-01'), // Default sana
    });

    const promoted = [];
    for (const customer of customers) {
      // Tug'ilgan kun kiritish uchun eslatma
      promoted.push({
        _id: customer._id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        totalOrders: customer.totalOrders,
        needsBirthdate: true,
      });
    }

    res.json({ 
      success: true, 
      message: `${promoted.length} ta VIP mijoz topildi`,
      customers: promoted 
    });
  } catch (error: any) {
    console.error("[orders] Auto-promote error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
