/**
 * Starter Seed Data Module for Database Initialization
 */

window.SEED_DATA = {
  businessProfile: {
    businessName: "Abhijeet Gourmet Cafe & Bistro",
    logo: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&auto=format&fit=crop&q=80",
    address: "Plot 45, Sector 18, Commercial Hub, New Delhi - 110001",
    gstNumber: "07AAAAA0000A1Z5",
    gstPercentage: 5, // 5% GST standard for restaurant food
    phone: "+91 98765 43210",
    email: "contact@abhijeetcafe.com",
    invoicePrefix: "AG-INV-",
    invoiceFooter: "Thank you for dining with us! Please visit again."
  },

  categories: [
    "Starters", "Main Course", "Biryani", "Tandoor", "Indian", "Chinese", 
    "Momos", "Noodles", "Beverages", "Mocktails", "Coffee", "Desserts", "Healthy/Gym Food"
  ],

  tables: [
    { tableId: "tbl_01", tableNumber: "Table 01", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_02", tableNumber: "Table 02", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_03", tableNumber: "Table 03", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_04", tableNumber: "Table 04", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_05", tableNumber: "Table 05", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_06", tableNumber: "Table 06", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_07", tableNumber: "Table 07", status: "AVAILABLE", isActive: true, currentSessionId: null },
    { tableId: "tbl_08", tableNumber: "Table 08", status: "AVAILABLE", isActive: true, currentSessionId: null }
  ],

  products: [
    {
      productId: "prod_01",
      foodName: "Paneer Tikka Tandoori",
      category: "Starters",
      description: "Charcoal grilled cottage cheese marinated in rich spiced yogurt.",
      price: 280,
      imageUrl: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500&auto=format&fit=crop&q=80",
      isAvailable: true,
      inventoryLinked: true,
      inventoryId: "inv_paneer",
      inventoryQuantity: 45,
      lowStockThreshold: 10,
      createdAt: Date.now()
    },
    {
      productId: "prod_02",
      foodName: "Butter Chicken Special",
      category: "Main Course",
      description: "Tender chicken cooked in rich velvety tomato butter gravy.",
      price: 360,
      imageUrl: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=80",
      isAvailable: true,
      inventoryLinked: true,
      inventoryId: "inv_chicken",
      inventoryQuantity: 30,
      lowStockThreshold: 8,
      createdAt: Date.now()
    },
    {
      productId: "prod_03",
      foodName: "Hyderabadi Dum Biryani",
      category: "Biryani",
      description: "Fragrant long-grain basmati rice cooked with marinated chicken and aromatic spices.",
      price: 340,
      imageUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80",
      isAvailable: true,
      inventoryLinked: true,
      inventoryId: "inv_rice",
      inventoryQuantity: 50,
      lowStockThreshold: 12,
      createdAt: Date.now()
    },
    {
      productId: "prod_04",
      foodName: "Steam Chicken Momos",
      category: "Momos",
      description: "Juicy minced chicken dumplings served with spicy Himalayan red chutney.",
      price: 180,
      imageUrl: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=500&auto=format&fit=crop&q=80",
      isAvailable: true,
      inventoryLinked: false,
      inventoryQuantity: 60,
      lowStockThreshold: 15,
      createdAt: Date.now()
    },
    {
      productId: "prod_05",
      foodName: "Hakka Noodles Special",
      category: "Chinese",
      description: "Wok-tossed noodles with crisp colorful veggies and soya sauce.",
      price: 220,
      imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&auto=format&fit=crop&q=80",
      isAvailable: true,
      inventoryLinked: false,
      inventoryQuantity: 40,
      lowStockThreshold: 10,
      createdAt: Date.now()
    },
    {
      productId: "prod_06",
      foodName: "Iced Cold Brew Coffee",
      category: "Coffee",
      description: "Slow brewed artisan espresso over ice with milk foam.",
      price: 160,
      imageUrl: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=80",
      isAvailable: true,
      inventoryLinked: true,
      inventoryId: "inv_coffee",
      inventoryQuantity: 25,
      lowStockThreshold: 5,
      createdAt: Date.now()
    },
    {
      productId: "prod_07",
      foodName: "High-Protein Whey Shake",
      category: "Healthy/Gym Food",
      description: "30g protein shake with banana, oats, almond butter, and dark chocolate.",
      price: 210,
      imageUrl: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=80",
      isAvailable: true,
      inventoryLinked: false,
      inventoryQuantity: 30,
      lowStockThreshold: 5,
      createdAt: Date.now()
    },
    {
      productId: "prod_08",
      foodName: "Virgin Mojito Refresh",
      category: "Mocktails",
      description: "Chilled sparkling soda infused with fresh mint, lime, and cane sugar.",
      price: 150,
      imageUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=80",
      isAvailable: true,
      inventoryLinked: false,
      inventoryQuantity: 50,
      lowStockThreshold: 10,
      createdAt: Date.now()
    },
    {
      productId: "prod_09",
      foodName: "Sizzling Chocolate Brownie",
      category: "Desserts",
      description: "Warm fudgy brownie topped with vanilla bean ice cream and hot chocolate fudge.",
      price: 240,
      imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=80",
      isAvailable: true,
      inventoryLinked: false,
      inventoryQuantity: 20,
      lowStockThreshold: 5,
      createdAt: Date.now()
    }
  ],

  inventory: [
    { inventoryId: "inv_paneer", itemName: "Fresh Cottage Cheese (Paneer)", category: "Dairy", unit: "Kg", currentQuantity: 45, minimumQuantity: 10, purchasePrice: 240, supplier: "Amul Dairy Corp", updatedAt: Date.now() },
    { inventoryId: "inv_chicken", itemName: "Fresh Farm Chicken", category: "Poultry", unit: "Kg", currentQuantity: 30, minimumQuantity: 8, purchasePrice: 210, supplier: "FreshMeat Co", updatedAt: Date.now() },
    { inventoryId: "inv_rice", itemName: "Royal Basmati Rice", category: "Grains", unit: "Kg", currentQuantity: 50, minimumQuantity: 12, purchasePrice: 110, supplier: "Fortune Agro", updatedAt: Date.now() },
    { inventoryId: "inv_coffee", itemName: "Arabica Coffee Beans", category: "Beverage Raw", unit: "Kg", currentQuantity: 25, minimumQuantity: 5, purchasePrice: 650, supplier: "Blue Tokai Coffee", updatedAt: Date.now() }
  ],

  capital: [
    { capitalId: "cap_01", type: "INITIAL_CAPITAL", amount: 500000, description: "Initial Business Establishment Capital", date: new Date().toISOString().substring(0, 10), createdBy: "Super Admin" }
  ],

  expenses: [
    { expenseId: "exp_01", category: "Rent", amount: 45000, description: "Monthly Shop Premises Rent", paymentMode: "Bank Transfer", date: new Date().toISOString().substring(0, 10), createdBy: "Super Admin", createdAt: Date.now() },
    { expenseId: "exp_02", category: "Electricity", amount: 12500, description: "Commercial Electricity Bill", paymentMode: "UPI", date: new Date().toISOString().substring(0, 10), createdBy: "Super Admin", createdAt: Date.now() },
    { expenseId: "exp_03", category: "Raw Materials", amount: 28000, description: "Weekly Grocery & Dairy Stock Purchase", paymentMode: "Cash", date: new Date().toISOString().substring(0, 10), createdBy: "Cafe Manager", createdAt: Date.now() }
  ],

  managers: [
    { managerId: "mgr_01", name: "Ramesh Sharma", email: "manager@abhijeetcafe.com", mobile: "9876543210", role: "cafe_manager", isActive: true, createdAt: Date.now() }
  ]
};
