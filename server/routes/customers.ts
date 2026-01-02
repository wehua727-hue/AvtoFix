import { Request, Response } from "express";
import { CustomerModel } from "../customer.model";
import { connectMongo } from "../mongo";

// Get all customers
export async function handleCustomersGet(req: Request, res: Response) {
  try {
    await connectMongo();
    const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID kerak' });
    }
    
    const customers = await CustomerModel.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, customers });
  } catch (error: any) {
    console.error("[customers] Get error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Create customer
export async function handleCustomerCreate(req: Request, res: Response) {
  try {
    await connectMongo();
    const { firstName, lastName, phone, birthDate, notes, userId } = req.body;
    
    const finalUserId = userId || req.userId || req.headers['x-user-id'];
    
    if (!finalUserId) {
      return res.status(400).json({ success: false, error: 'User ID kerak' });
    }

    if (!firstName || !lastName || !birthDate) {
      return res.status(400).json({
        success: false,
        error: "Ism, familiya va tug'ilgan kun majburiy",
      });
    }

    const customer = new CustomerModel({
      userId: finalUserId,
      firstName,
      lastName,
      phone,
      birthDate: new Date(birthDate),
      notes,
      totalOrders: 0,
      totalSpent: 0,
    });

    await customer.save();
    res.json({ success: true, customer });
  } catch (error: any) {
    console.error("[customers] Create error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Update customer
export async function handleCustomerUpdate(req: Request, res: Response) {
  try {
    await connectMongo();
    const { id } = req.params;
    const { firstName, lastName, phone, birthDate, notes } = req.body;

    const customer = await CustomerModel.findByIdAndUpdate(
      id,
      {
        firstName,
        lastName,
        phone,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        notes,
      },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ success: false, error: "Mijoz topilmadi" });
    }

    res.json({ success: true, customer });
  } catch (error: any) {
    console.error("[customers] Update error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Delete customer
export async function handleCustomerDelete(req: Request, res: Response) {
  try {
    await connectMongo();
    const { id } = req.params;

    const customer = await CustomerModel.findByIdAndDelete(id);

    if (!customer) {
      return res.status(404).json({ success: false, error: "Mijoz topilmadi" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[customers] Delete error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get birthday notifications
export async function handleBirthdayNotifications(req: Request, res: Response) {
  try {
    await connectMongo();
    
    const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID kerak' });
    }
    
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    // Get only this user's customers
    const customers = await CustomerModel.find({ userId });

    const notifications = customers
      .map((customer) => {
        const birthDate = new Date(customer.birthDate);
        const birthMonth = birthDate.getMonth() + 1;
        const birthDay = birthDate.getDate();

        // Check if birthday is today
        const isToday = birthMonth === todayMonth && birthDay === todayDay;

        // Calculate days until birthday
        let daysUntil = 0;
        if (!isToday) {
          const thisYearBirthday = new Date(today.getFullYear(), birthMonth - 1, birthDay);
          if (thisYearBirthday < today) {
            thisYearBirthday.setFullYear(today.getFullYear() + 1);
          }
          daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          customer: {
            _id: customer._id.toString(),
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            birthDate: customer.birthDate.toISOString(),
            totalOrders: customer.totalOrders,
            totalSpent: customer.totalSpent,
          },
          daysUntil,
          isToday,
        };
      })
      .filter((n) => n.isToday || n.daysUntil <= 7) // Show today and next 7 days
      .sort((a, b) => a.daysUntil - b.daysUntil);

    res.json({ success: true, notifications });
  } catch (error: any) {
    console.error("[customers] Birthday notifications error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get top customers
export async function handleTopCustomers(req: Request, res: Response) {
  try {
    await connectMongo();
    
    const userId = req.userId || req.headers['x-user-id'] || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID kerak' });
    }
    
    const topByOrders = await CustomerModel.find({ userId })
      .sort({ totalOrders: -1 })
      .limit(10);

    const topBySpent = await CustomerModel.find({ userId })
      .sort({ totalSpent: -1 })
      .limit(10);

    res.json({
      success: true,
      topByOrders,
      topBySpent,
    });
  } catch (error: any) {
    console.error("[customers] Top customers error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
