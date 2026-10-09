// Seed Data Script for Lamba Panel
// Generates: 4 Warehouses, 40 Products, 200 Shops, 1,000 Orders, Matching Purchases, Expenses, & Customer Ledgers (~40k remaining balance)

const RTDB_BASE = 'https://panel-adefe-default-rtdb.firebaseio.com';

// Targeted active companies (or pass companyId as node script argument)
const TARGET_COMPANIES = [
  'company_ihdsai1qi8ysfj646hhb',
  'company_3qkffrmex6n3abmft93l',
  'company_objq3fc250q39kgmcs61',
  'company_d2ziidkdqv1oxlrlgagn'
];

const WAREHOUSES_DATA = [
  { id: 'wh_1', name: 'Central Logistics Hub (Main)', address: 'Plot 42, Industrial Area, Sector I-9, Islamabad', notes: 'Primary central distribution hub' },
  { id: 'wh_2', name: 'North Zone Depot', address: 'Warehouse #18, G.T. Road, Peshawar', notes: 'Regional distribution for northern sector' },
  { id: 'wh_3', name: 'East Distribution Center', address: 'Gate 4, Multan Road, Lahore', notes: 'Major FMCG storage center' },
  { id: 'wh_4', name: 'South Port Warehouse', address: 'S.I.T.E. Industrial Area, Karachi', notes: 'Import & coastal bulk warehouse' }
];

const RAW_PRODUCTS = [
  { name: 'Nestlé Everyday Tea Whitener 900g', cat: 'Dairy & Beverages', cost: 1100, price: 1250, boxQty: 10, sub: 12, pcsSub: 24 },
  { name: 'Ariel Power Gel Liquid Detergent 1L', cat: 'Household & Laundry', cost: 850, price: 1050, boxQty: 15, sub: 6, pcsSub: 12 },
  { name: 'Lipton Yellow Label Black Tea 475g', cat: 'Tea & Coffee', cost: 920, price: 1100, boxQty: 12, sub: 10, pcsSub: 20 },
  { name: 'Shan Biryani Recipe Masala Mix 50g', cat: 'Spices & Recipe Mixes', cost: 85, price: 110, boxQty: 25, sub: 24, pcsSub: 12 },
  { name: 'Coca-Cola Soft Drink 1.5L Bottle', cat: 'Beverages & Drinks', cost: 140, price: 175, boxQty: 40, sub: 6, pcsSub: 6 },
  { name: 'Pepsi Cola Refreshing Drink 1.5L', cat: 'Beverages & Drinks', cost: 140, price: 175, boxQty: 40, sub: 6, pcsSub: 6 },
  { name: 'Olper\'s Full Cream Milk 1L UHT', cat: 'Dairy & Beverages', cost: 240, price: 280, boxQty: 30, sub: 12, pcsSub: 12 },
  { name: 'Dawn Bread Super Family Size', cat: 'Bakery & Fresh Food', cost: 130, price: 160, boxQty: 20, sub: 1, pcsSub: 10 },
  { name: 'Surf Excel Easy Wash Powder 1kg', cat: 'Household & Laundry', cost: 520, price: 630, boxQty: 18, sub: 10, pcsSub: 10 },
  { name: 'Colgate MaxFresh Cooling Crystals 150g', cat: 'Personal Care & Hygiene', cost: 210, price: 270, boxQty: 25, sub: 12, pcsSub: 12 },
  { name: 'Tapal Danedar Black Tea 450g Pack', cat: 'Tea & Coffee', cost: 890, price: 1060, boxQty: 14, sub: 10, pcsSub: 20 },
  { name: 'Knorr Chicken Stock Cubes 12 Pack', cat: 'Spices & Cooking Essentials', cost: 160, price: 210, boxQty: 30, sub: 12, pcsSub: 12 },
  { name: 'Head & Shoulders Shampoo 360ml', cat: 'Hair Care', cost: 680, price: 840, boxQty: 15, sub: 12, pcsSub: 12 },
  { name: 'Dettol Original Hygiene Soap 135g', cat: 'Personal Care & Hygiene', cost: 120, price: 155, boxQty: 50, sub: 12, pcsSub: 12 },
  { name: 'Lux International Beauty Soap 150g', cat: 'Personal Care & Hygiene', cost: 125, price: 160, boxQty: 50, sub: 12, pcsSub: 12 },
  { name: 'Pantene Pro-V Smooth Shampoo 360ml', cat: 'Hair Care', cost: 670, price: 830, boxQty: 15, sub: 12, pcsSub: 12 },
  { name: 'National Tomato Ketchup 950g Squeeze', cat: 'Sauces & Condiments', cost: 410, price: 510, boxQty: 20, sub: 12, pcsSub: 12 },
  { name: 'Dalda Fortified Cooking Oil 5L Pouch', cat: 'Cooking Oil & Ghee', cost: 2450, price: 2780, boxQty: 10, sub: 4, pcsSub: 4 },
  { name: 'Sufi Pure Sunflower Cooking Oil 5L', cat: 'Cooking Oil & Ghee', cost: 2420, price: 2750, boxQty: 10, sub: 4, pcsSub: 4 },
  { name: 'Mitchell\'s Fresh Mango Jam 450g', cat: 'Breakfast & Jams', cost: 280, price: 360, boxQty: 20, sub: 12, pcsSub: 12 },
  { name: 'Sensodyne Fast Relief Toothpaste 100g', cat: 'Personal Care & Hygiene', cost: 360, price: 460, boxQty: 25, sub: 12, pcsSub: 12 },
  { name: 'Mezan Premium Banaspati Ghee 1kg', cat: 'Cooking Oil & Ghee', cost: 480, price: 560, boxQty: 25, sub: 12, pcsSub: 12 },
  { name: 'Nestle Fruita Vitals Juice 1L', cat: 'Beverages & Drinks', cost: 260, price: 320, boxQty: 25, sub: 12, pcsSub: 12 },
  { name: 'Sprite Lemon Lime Soda 1.5L', cat: 'Beverages & Drinks', cost: 140, price: 175, boxQty: 40, sub: 6, pcsSub: 6 },
  { name: '7UP Refreshing Soda 1.5L Bottle', cat: 'Beverages & Drinks', cost: 140, price: 175, boxQty: 40, sub: 6, pcsSub: 6 },
  { name: 'National Chilli Garlic Sauce 800g', cat: 'Sauces & Condiments', cost: 390, price: 490, boxQty: 20, sub: 12, pcsSub: 12 },
  { name: 'Shan Special Nihari Masala 50g', cat: 'Spices & Recipe Mixes', cost: 85, price: 110, boxQty: 25, sub: 24, pcsSub: 12 },
  { name: 'Nestlé Nido Fortigrow Milk 900g', cat: 'Dairy & Beverages', cost: 1480, price: 1750, boxQty: 10, sub: 12, pcsSub: 12 },
  { name: 'Young\'s Mayo Garlic Dip 500g', cat: 'Sauces & Condiments', cost: 290, price: 370, boxQty: 20, sub: 12, pcsSub: 12 },
  { name: 'Blue Band Spreadable Butter 250g', cat: 'Breakfast & Spreads', cost: 230, price: 290, boxQty: 30, sub: 12, pcsSub: 12 },
  { name: 'Peek Freans Rio Biscuits Box', cat: 'Snacks & Biscuits', cost: 280, price: 360, boxQty: 30, sub: 12, pcsSub: 12 },
  { name: 'LU Prince Chocolate Biscuits Pack', cat: 'Snacks & Biscuits', cost: 270, price: 350, boxQty: 30, sub: 12, pcsSub: 12 },
  { name: 'Bisconni Chocolatto Biscuits Box', cat: 'Snacks & Biscuits', cost: 260, price: 340, boxQty: 30, sub: 12, pcsSub: 12 },
  { name: 'Sooper Egg & Milk Biscuits Box', cat: 'Snacks & Biscuits', cost: 290, price: 370, boxQty: 30, sub: 12, pcsSub: 12 },
  { name: 'Lifebuoy Total 10 Soap 135g', cat: 'Personal Care & Hygiene', cost: 115, price: 150, boxQty: 50, sub: 12, pcsSub: 12 },
  { name: 'Sunsilk Black Shine Shampoo 360ml', cat: 'Hair Care', cost: 650, price: 810, boxQty: 15, sub: 12, pcsSub: 12 },
  { name: 'Rooh Afza Syrup Bottle 800ml', cat: 'Beverages & Drinks', cost: 310, price: 390, boxQty: 20, sub: 12, pcsSub: 12 },
  { name: 'Tang Orange Instant Drink 500g', cat: 'Beverages & Drinks', cost: 420, price: 520, boxQty: 20, sub: 12, pcsSub: 12 },
  { name: 'Shezan Mango Drink 250ml (24 Pcs)', cat: 'Beverages & Drinks', cost: 840, price: 1020, boxQty: 15, sub: 1, pcsSub: 24 },
  { name: 'Habib Pure Banaspati Ghee 1kg', cat: 'Cooking Oil & Ghee', cost: 470, price: 550, boxQty: 25, sub: 12, pcsSub: 12 }
];

const SHOP_PREFIXES = ['Al-Madina', 'Bismillah', 'Rahim', 'Al-Makkah', 'Iqbal', 'Green Valley', 'Punjab', 'Usman', 'Khan', 'Standard', 'Al-Habib', 'New City', 'Apex', 'Madni', 'Universal', 'Falcon', 'Crown', 'Star', 'City Corner', 'Zubair', 'Golden Grain', 'Paradise', 'Grand Bazar', 'Popular', 'Smart Buy', 'Al-Rehman', 'Prime', 'Super Star', 'Sunshine', 'Unique', 'Metro', 'Galaxy', 'Zamzam', 'Khyber', 'Care', 'National', 'Al-Faisal', 'Orient', 'Capital', 'Elegance', 'Al-Mustafa', 'Shaheen', 'United', 'Grand City', 'Chaudhry', 'Royal', 'Grace', 'Silver Star', 'Pioneer', 'Model'];
const SHOP_TYPES = ['General Store', 'Super Market', 'Traders', 'Cash & Carry', 'Kiryana Store', 'Mart', 'Provision Store', 'Mini Mart', 'Departmental Store', 'Wholesale Corner'];
const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Gujranwala', 'Sialkot'];

function generateShops() {
  const shops = [];
  let idCounter = 1;
  for (let i = 0; i < SHOP_PREFIXES.length; i++) {
    for (let j = 0; j < SHOP_TYPES.length; j++) {
      if (shops.length >= 200) break;
      const prefix = SHOP_PREFIXES[i];
      const type = SHOP_TYPES[j];
      const city = CITIES[(i + j) % CITIES.length];
      const name = `${prefix} ${type}`;
      const ownerName = `Mr. ${prefix} Owner`;
      const phone = `0300-${Math.floor(1000000 + Math.random() * 9000000)}`;
      const shopAddress = `Shop #${idCounter}, Main Commercial Sector, ${city}`;

      shops.push({
        id: `cust_${idCounter}`,
        name,
        ownerName,
        phone,
        shopAddress,
        city,
        category: j % 2 === 0 ? 'Retail' : 'Wholesale',
        currentBalance: 0,
        initialBalance: 0,
        createdAt: 1780000000000 - (200 - idCounter) * 86400000
      });
      idCounter++;
    }
  }
  return shops;
}

export async function seedDatabase(targetCompanyId) {
  console.log(`Starting Database Seeding for Company ID: ${targetCompanyId}...`);

  // 1. Create 4 Warehouses
  const warehousesMap = {};
  WAREHOUSES_DATA.forEach(w => {
    warehousesMap[w.id] = { ...w, creationDate: '2026-05-01' };
  });

  // 2. Create 40 Products & Distribute across Warehouses
  const productsMap = {};
  const productList = [];
  RAW_PRODUCTS.forEach((p, index) => {
    const pId = `prod_${index + 1}`;
    const assignedWh = WAREHOUSES_DATA[index % WAREHOUSES_DATA.length];
    
    // Total stock: Boxes + pcs
    const totalPcs = p.boxQty * (p.sub * p.pcsSub);
    const prodObj = {
      id: pId,
      name: p.name,
      sku: `SKU-${1000 + index + 1}`,
      category: p.cat,
      unit: 'pcs',
      unitType: 'box',
      purchasePrice: p.cost,
      salePrice: p.price,
      currentStock: totalPcs,
      minimumStock: 50,
      warehouseId: assignedWh.id,
      warehouseName: assignedWh.name,
      boxDetails: {
        pricePerBox: p.cost * p.sub * p.pcsSub,
        boxQty: p.boxQty,
        hasSubBoxes: true,
        subBoxesPerBox: p.sub,
        pcsPerSubBox: p.pcsSub,
        pcsPerBox: p.sub * p.pcsSub,
        freePcsPerBox: 0,
        totalPieces: totalPcs,
        totalBuyingCost: p.cost * totalPcs,
        calculatedCostPerPiece: p.cost
      },
      createdAt: 1780000000000 - (40 - index) * 86400000
    };

    productsMap[pId] = prodObj;
    productList.push(prodObj);
  });

  // 3. Create 200 Shops
  const shopsList = generateShops();
  const shopsMap = {};
  shopsList.forEach(s => { shopsMap[s.id] = s; });

  // 4. Generate 1,000 Total Orders
  const TOTAL_ORDERS = 1000;
  const ordersMap = {};
  const customerLedgersMap = {};
  const paymentsMap = {};

  // Track customer balance accumulator
  const shopBalances = {};
  shopsList.forEach(s => { shopBalances[s.id] = 0; });

  // Distribute 1,000 orders across 200 shops (approx 5 orders per shop)
  let orderCounter = 1001;
  const baseTimestamp = new Date('2026-06-01').getTime();
  const nowTimestamp = new Date('2026-10-08').getTime();

  for (let i = 0; i < TOTAL_ORDERS; i++) {
    const shopIndex = i % shopsList.length;
    const shop = shopsList[shopIndex];
    const orderId = `ord_${orderCounter}`;
    const orderNumber = `ORD-${orderCounter}`;

    // Select 1 to 3 products randomly
    const numItems = (i % 3) + 1;
    const orderItems = [];
    let grandTotal = 0;

    for (let k = 0; k < numItems; k++) {
      const prod = productList[(i + k * 7) % productList.length];
      const qty = ((i + k) % 5) + 1; // 1 to 5 units
      const lineTotal = qty * prod.salePrice;
      grandTotal += lineTotal;

      orderItems.push({
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        unitType: 'pcs',
        quantity: qty,
        unitPrice: prod.salePrice,
        lineTotal: lineTotal
      });
    }

    const orderTime = baseTimestamp + Math.floor((nowTimestamp - baseTimestamp) * (i / TOTAL_ORDERS));
    const orderDate = new Date(orderTime).toISOString().split('T')[0];

    const orderObj = {
      id: orderId,
      orderNumber,
      customerId: shop.id,
      customerName: shop.name,
      shopName: shop.name,
      date: orderDate,
      status: i > 980 ? 'Processing' : 'Delivered',
      paymentType: 'Credit',
      paymentStatus: 'Paid',
      items: orderItems,
      grandTotal: grandTotal,
      discount: 0,
      netAmount: grandTotal,
      createdAt: orderTime
    };

    ordersMap[orderId] = orderObj;

    // Customer Ledger Entry for Order Invoice (Debit)
    if (!customerLedgersMap[shop.id]) customerLedgersMap[shop.id] = {};

    shopBalances[shop.id] += grandTotal;
    const invoiceLedgerId = `ledg_inv_${orderCounter}`;
    customerLedgersMap[shop.id][invoiceLedgerId] = {
      id: invoiceLedgerId,
      customerId: shop.id,
      date: orderDate,
      type: 'Invoice',
      referenceId: orderNumber,
      description: `Invoice for Order #${orderNumber}`,
      debit: grandTotal,
      credit: 0,
      balance: shopBalances[shop.id],
      createdAt: orderTime
    };

    // Record Customer Payment (Credit) for almost all orders so remaining balance equals ~40,000 Rs overall
    // Target overall total remaining balance = ~40,000 Rs (approx 200 Rs balance per shop average)
    // Pay most orders fully, but leave small partial balance on some shops
    const leaveUnpaid = (i % 38 === 0 || i % 45 === 0);
    const paymentAmount = leaveUnpaid ? Math.max(0, grandTotal - 1450) : grandTotal;

    if (paymentAmount > 0) {
      shopBalances[shop.id] -= paymentAmount;
      const paymentId = `pay_${orderCounter}`;
      const payTime = orderTime + 3600000 * 2;
      const payDate = new Date(payTime).toISOString().split('T')[0];

      paymentsMap[paymentId] = {
        id: paymentId,
        customerId: shop.id,
        customerName: shop.name,
        amount: paymentAmount,
        date: payDate,
        paymentMethod: (i % 2 === 0) ? 'Cash' : 'Bank Transfer',
        reference: `REC-${orderCounter}`,
        notes: `Payment for Invoice #${orderNumber}`,
        createdAt: payTime
      };

      const payLedgerId = `ledg_pay_${orderCounter}`;
      customerLedgersMap[shop.id][payLedgerId] = {
        id: payLedgerId,
        customerId: shop.id,
        date: payDate,
        type: 'Payment',
        referenceId: `REC-${orderCounter}`,
        description: `Payment received for Invoice #${orderNumber}`,
        debit: 0,
        credit: paymentAmount,
        balance: shopBalances[shop.id],
        createdAt: payTime
      };
    }

    orderCounter++;
  }

  // Update customer current balances in shopsMap
  shopsList.forEach(s => {
    shopsMap[s.id].currentBalance = Math.round(shopBalances[s.id] || 0);
  });

  // Calculate total unpaid customer balance
  const totalUnpaidBalance = Object.values(shopsMap).reduce((sum, s) => sum + s.currentBalance, 0);
  console.log(`Calculated Total Remaining Customer Ledger Balance across 200 shops: Rs. ${totalUnpaidBalance}`);

  // 5. Generate Purchases to match stock & suppliers
  const purchasesMap = {};
  const suppliersMap = {
    'sup_1': { id: 'sup_1', name: 'Nestlé Pakistan Wholesale', phone: '042-111637853', address: 'Lahore' },
    'sup_2': { id: 'sup_2', name: 'Unilever Pakistan Distributors', phone: '021-111666666', address: 'Karachi' },
    'sup_3': { id: 'sup_3', name: 'National Foods Supply Co.', phone: '021-35071601', address: 'Karachi' },
    'sup_4': { id: 'sup_4', name: 'Dalda Foods Ltd.', phone: '021-35060371', address: 'Karachi' }
  };

  for (let pIdx = 1; pIdx <= 15; pIdx++) {
    const purId = `pur_${100 + pIdx}`;
    const purItems = productList.slice((pIdx - 1) * 2, pIdx * 2 + 1).map(prod => ({
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      unitType: 'box',
      quantity: prod.currentStock,
      purchasePrice: prod.purchasePrice,
      salePrice: prod.salePrice,
      lineTotal: prod.boxDetails.totalBuyingCost
    }));

    const purTotal = purItems.reduce((s, item) => s + item.lineTotal, 0);
    purchasesMap[purId] = {
      id: purId,
      supplierName: Object.values(suppliersMap)[pIdx % 4].name,
      reference: `INV-2026-PUR-${100 + pIdx}`,
      notes: `Bulk warehouse inventory procurement shipment #${pIdx}`,
      date: '2026-06-10',
      grandTotal: purTotal,
      items: purItems,
      createdAt: 1780000000000 - pIdx * 86400000
    };
  }

  // 6. Generate Operating Expenses (Rent, Salaries, Logistics, Utilities)
  const expensesMap = {};
  const EXPENSE_ITEMS = [
    { title: 'Central Warehouse Monthly Rent', cat: 'Rent', amount: 85000, date: '2026-06-01' },
    { title: 'North Zone Depot Rent', cat: 'Rent', amount: 45000, date: '2026-06-01' },
    { title: 'Warehouse Operations & Logistics Staff Salaries', cat: 'Salaries', amount: 240000, date: '2026-06-05' },
    { title: 'Commercial Electricity & Utilities Bill', cat: 'Utilities', amount: 65000, date: '2026-06-10' },
    { title: 'Freight & Fleet Transportation Fuel Charges', cat: 'Transport & Freight', amount: 110000, date: '2026-06-15' },
    { title: 'Packaging Materials & Box Strapping Supplies', cat: 'Packaging & Office', amount: 35000, date: '2026-06-20' },
    { title: 'Central Warehouse Monthly Rent', cat: 'Rent', amount: 85000, date: '2026-07-01' },
    { title: 'North Zone Depot Rent', cat: 'Rent', amount: 45000, date: '2026-07-01' },
    { title: 'Warehouse Operations Staff Salaries', cat: 'Salaries', amount: 240000, date: '2026-07-05' },
    { title: 'Commercial Electricity & Power Bill', cat: 'Utilities', amount: 72000, date: '2026-07-10' },
    { title: 'Logistics Fleet Maintenance & Fuel', cat: 'Transport & Freight', amount: 125000, date: '2026-07-18' },
    { title: 'Central Warehouse Monthly Rent', cat: 'Rent', amount: 85000, date: '2026-08-01' },
    { title: 'North Zone Depot Rent', cat: 'Rent', amount: 45000, date: '2026-08-01' },
    { title: 'Warehouse Operations Staff Salaries', cat: 'Salaries', amount: 240000, date: '2026-08-05' },
    { title: 'Commercial Electricity Bill', cat: 'Utilities', amount: 68000, date: '2026-08-12' },
    { title: 'Freight & Transport Charges', cat: 'Transport & Freight', amount: 115000, date: '2026-08-22' }
  ];

  EXPENSE_ITEMS.forEach((exp, idx) => {
    const expId = `exp_${101 + idx}`;
    expensesMap[expId] = {
      id: expId,
      title: exp.title,
      category: exp.cat,
      amount: exp.amount,
      date: exp.date,
      paymentMethod: 'Bank Transfer',
      notes: 'Operational business overhead expense',
      createdAt: new Date(exp.date).getTime()
    };
  });

  // 7. Write to Firebase RTDB for Target Company
  const fullCompanyPayload = {
    info: {
      name: 'Lamba Wholesale & Logistics Ltd.',
      currency: 'Rs',
      address: 'Industrial Sector I-9, Islamabad',
      phone: '051-111-222-333',
      notes: 'Premier Wholesale FMCG Distribution Network'
    },
    warehouses: warehousesMap,
    products: productsMap,
    customers: shopsMap,
    orders: ordersMap,
    purchases: purchasesMap,
    suppliers: suppliersMap,
    expenses: expensesMap,
    payments: paymentsMap,
    customerLedgers: customerLedgersMap
  };

  const url = `${RTDB_BASE}/companies/${targetCompanyId}.json`;
  console.log(`Pushing data to Firebase: ${url}...`);

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullCompanyPayload)
  });

  if (!response.ok) {
    throw new Error(`Failed to push data: ${response.statusText}`);
  }

  console.log(`✅ SUCCESS! Company ${targetCompanyId} seeded with 4 Warehouses, 40 Products, 200 Shops, 1,000 Orders, Purchases, Expenses, & ~Rs. ${totalUnpaidBalance} remaining Customer Ledger Balance!`);
}

// Execute for target companies if run directly
async function main() {
  for (const cid of TARGET_COMPANIES) {
    try {
      await seedDatabase(cid);
    } catch (err) {
      console.error(`Error seeding company ${cid}:`, err);
    }
  }
}

if (process.argv[1] && process.argv[1].includes('seedData.js')) {
  main();
}
