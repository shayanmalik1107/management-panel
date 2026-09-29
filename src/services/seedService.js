import { ref, update } from 'firebase/database';
import { database } from '../firebase';

/**
 * Bulk seed 1,000 orders, 100 shops/customers, and 100 products for performance testing
 */
export async function seedTestData(companyId, onProgress) {
  if (!companyId) throw new Error('No company ID provided');

  const updates = {};
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  // 1. Generate 100 Products
  if (onProgress) onProgress('Generating 100 products...');
  const products = [];
  const categories = ['Beverages', 'Snacks', 'Groceries', 'Dairy', 'Confectionery', 'Bakery', 'Electronics', 'Hardware'];

  for (let i = 1; i <= 100; i++) {
    const prodId = `prod_seed_${i}`;
    const category = categories[i % categories.length];
    const salePrice = Math.floor(Math.random() * 450) * 10 + 50; // 50 to 4550
    const costPrice = Math.floor(salePrice * (0.6 + Math.random() * 0.25)); // 60-85% of sale price
    const stock = Math.floor(Math.random() * 400) + 20;

    const prodData = {
      id: prodId,
      name: `Test Product #${i} (${category})`,
      categoryName: category,
      sku: `SKU-${1000 + i}`,
      salePrice: salePrice,
      costPriceAtSale: costPrice,
      purchasePrice: costPrice,
      costPrice: costPrice,
      currentStock: stock,
      minimumStock: 10,
      unit: 'pcs',
      status: 'active',
      createdAt: now - Math.floor(Math.random() * ninetyDaysMs),
    };

    products.push(prodData);
    updates[`companies/${companyId}/products/${prodId}`] = prodData;
  }

  // 2. Generate 100 Customers / Shops
  if (onProgress) onProgress('Generating 100 customer shops...');
  const customers = [];
  const cities = ['Lahore', 'Karachi', 'Islamabad', 'Faisalabad', 'Multan', 'Peshawar', 'Rawalpindi', 'Quetta'];
  const shopTypes = ['Superstore', 'Mart', 'Traders', 'General Store', 'Wholesale', 'Cash & Carry'];

  for (let i = 1; i <= 100; i++) {
    const custId = `cust_seed_${i}`;
    const city = cities[i % cities.length];
    const type = shopTypes[i % shopTypes.length];
    const shopName = `Shop ${i} ${city} ${type}`;
    const ownerName = `Owner ${i} Malik`;

    const custData = {
      id: custId,
      shopName: shopName,
      customerName: shopName,
      name: ownerName,
      ownerName: ownerName,
      phone: `0300-${Math.floor(1000000 + Math.random() * 9000000)}`,
      city: city,
      address: `Plot #${i * 3}, Main Bazaar, ${city}`,
      currentBalance: Math.floor(Math.random() * 500) * 100, // 0 to 50,000
      totalOrders: 10,
      totalSales: Math.floor(Math.random() * 2000) * 100,
      createdAt: now - Math.floor(Math.random() * ninetyDaysMs),
    };

    customers.push(custData);
    updates[`companies/${companyId}/customers/${custId}`] = custData;
  }

  // 3. Generate 1,000 Orders
  if (onProgress) onProgress('Generating 1,000 orders...');
  for (let i = 1; i <= 1000; i++) {
    const orderId = `ord_seed_${i}`;
    const orderNum = `ORD-${String(i).padStart(6, '0')}`;
    const cust = customers[i % customers.length];
    const orderDate = now - Math.floor(Math.random() * ninetyDaysMs);

    // Pick 1-4 random products
    const itemNum = Math.floor(Math.random() * 3) + 1;
    const itemsObj = {};
    let grandTotal = 0;

    for (let j = 0; j < itemNum; j++) {
      const prod = products[(i * 7 + j * 13) % products.length];
      const qty = Math.floor(Math.random() * 10) + 1;
      const lineTotal = prod.salePrice * qty;
      grandTotal += lineTotal;

      itemsObj[`item_${j}`] = {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        quantity: qty,
        salePrice: prod.salePrice,
        costPriceAtSale: prod.costPriceAtSale,
        lineTotal: lineTotal,
      };
    }

    const isCash = i % 2 === 0;

    const orderData = {
      id: orderId,
      orderNumber: orderNum,
      companyId: companyId,
      customerId: cust.id,
      customerName: cust.shopName,
      customerPhone: cust.phone,
      customerAddress: cust.address,
      items: itemsObj,
      grandTotal: grandTotal,
      amountPaid: isCash ? grandTotal : 0,
      paymentType: isCash ? 'cash' : 'credit',
      paymentStatus: isCash ? 'paid' : 'unpaid',
      status: 'completed',
      createdBy: 'seed_admin',
      createdByName: 'System Admin',
      createdAt: orderDate,
      updatedAt: orderDate,
    };

    updates[`companies/${companyId}/orders/${orderId}`] = orderData;
  }

  // Update order counter
  updates[`companies/${companyId}/counters/orderCounter`] = 1000;

  if (onProgress) onProgress('Writing 1,200 records to Firebase database...');
  await update(ref(database), updates);
  if (onProgress) onProgress('Done!');
  return true;
}
