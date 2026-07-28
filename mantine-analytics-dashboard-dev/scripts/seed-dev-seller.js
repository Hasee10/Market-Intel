#!/usr/bin/env node
// Dev-only seed script: creates one demo seller (via a real Supabase Auth
// user, so the 013_seller_signup_trigger.sql trigger provisions the
// `sellers` row) plus sample products/customers/orders, so the app has
// something real to render while BYPASS_AUTH=1 is on (see .env.local and
// src/lib/supabase/server.ts). Safe to re-run - it's idempotent on the
// demo user's email.
//
// Usage: node scripts/seed-dev-seller.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2];
    });
  return env;
}

const DEMO_EMAIL = 'demo-seller@marketintel.dev';
const DEMO_PASSWORD = 'demo-seller-password-1234';

const CATEGORY_SLUGS = ['mobiles-and-electronics', 'home-and-kitchen', 'beauty-and-personal-care'];

const PRODUCTS = [
  { title: 'Wireless Earbuds Pro', sku: 'WEB-001', cost: 3200, sell: 5999, stock: 140, category: 0 },
  { title: 'Smart Fitness Band', sku: 'SFB-002', cost: 1800, sell: 3499, stock: 65, category: 0 },
  { title: '4K Action Camera', sku: 'AC-003', cost: 8500, sell: 14999, stock: 22, category: 0 },
  { title: 'Bluetooth Speaker Mini', sku: 'BSM-004', cost: 1200, sell: 2499, stock: 210, category: 0 },
  { title: 'Non-Stick Cookware Set', sku: 'NCS-005', cost: 4500, sell: 7999, stock: 38, category: 1 },
  { title: 'Electric Kettle 1.7L', sku: 'EK-006', cost: 1500, sell: 2999, stock: 90, category: 1 },
  { title: 'Ceramic Dinner Set (16pc)', sku: 'CDS-007', cost: 3800, sell: 6499, stock: 15, category: 1 },
  { title: 'Vitamin C Serum 30ml', sku: 'VCS-008', cost: 600, sell: 1499, stock: 300, category: 2 },
  { title: 'Argan Oil Hair Mask', sku: 'AOM-009', cost: 450, sell: 1199, stock: 8, category: 2 },
  { title: 'Matte Lipstick Set', sku: 'MLS-010', cost: 900, sell: 1999, stock: 120, category: 2 },
];

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'delivered', 'delivered', 'cancelled'];

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let userId;
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === DEMO_EMAIL);

  if (existing) {
    userId = existing.id;
    console.log('Demo auth user already exists:', userId);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { business_name: 'Aurora Retail Co.' },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log('Created demo auth user:', userId);
  }

  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('id, business_name')
    .eq('user_id', userId)
    .single();
  if (sellerError) throw sellerError;
  console.log('Seller row:', seller);

  const { data: categories, error: catError } = await supabase
    .from('seller_categories')
    .select('id, slug')
    .in('slug', CATEGORY_SLUGS);
  if (catError) throw catError;
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));
  const categoryIds = CATEGORY_SLUGS.map((s) => categoryBySlug[s]);

  await supabase
    .from('seller_domains')
    .upsert(
      categoryIds.map((category_id, i) => ({
        seller_id: seller.id,
        category_id,
        is_primary: i === 0,
      })),
      { onConflict: 'seller_id,category_id' },
    );

  const { data: existingProducts } = await supabase
    .from('seller_products')
    .select('id')
    .eq('seller_id', seller.id);

  let productIds;
  if (existingProducts && existingProducts.length > 0) {
    productIds = existingProducts.map((p) => p.id);
    console.log(`Products already seeded (${productIds.length}), skipping.`);
  } else {
    const { data: inserted, error: prodError } = await supabase
      .from('seller_products')
      .insert(
        PRODUCTS.map((p) => ({
          seller_id: seller.id,
          sku: p.sku,
          title: p.title,
          category_id: categoryIds[p.category],
          cost_price: p.cost,
          sell_price: p.sell,
          stock_qty: p.stock,
          is_active: true,
        })),
      )
      .select('id');
    if (prodError) throw prodError;
    productIds = inserted.map((p) => p.id);
    console.log(`Inserted ${productIds.length} products.`);
  }

  const { data: existingCustomers } = await supabase
    .from('seller_customers')
    .select('id')
    .eq('seller_id', seller.id);

  let customerIds;
  if (existingCustomers && existingCustomers.length > 0) {
    customerIds = existingCustomers.map((c) => c.id);
    console.log(`Customers already seeded (${customerIds.length}), skipping.`);
  } else {
    const now = Date.now();
    const customerRows = Array.from({ length: 25 }).map((_, i) => {
      const firstOrderDaysAgo = randomBetween(5, 180);
      const lastOrderDaysAgo = randomBetween(0, firstOrderDaysAgo);
      const ordersCount = randomBetween(1, 12);
      return {
        seller_id: seller.id,
        external_customer_id: `CUST-${1000 + i}`,
        email: `customer${i + 1}@example.com`,
        first_order_at: new Date(now - firstOrderDaysAgo * 86400000).toISOString(),
        last_order_at: new Date(now - lastOrderDaysAgo * 86400000).toISOString(),
        orders_count: ordersCount,
        total_spent: ordersCount * randomBetween(1500, 6000),
      };
    });
    const { data: inserted, error: custError } = await supabase
      .from('seller_customers')
      .insert(customerRows)
      .select('id');
    if (custError) throw custError;
    customerIds = inserted.map((c) => c.id);
    console.log(`Inserted ${customerIds.length} customers.`);
  }

  const { data: existingOrders } = await supabase
    .from('seller_orders')
    .select('id')
    .eq('seller_id', seller.id)
    .limit(1);

  if (existingOrders && existingOrders.length > 0) {
    console.log('Orders already seeded, skipping.');
  } else {
    const now = Date.now();
    const orderRows = Array.from({ length: 220 }).map((_, i) => {
      const daysAgo = randomBetween(0, 90);
      const status = STATUSES[randomBetween(0, STATUSES.length)];
      return {
        seller_id: seller.id,
        customer_id: customerIds[randomBetween(0, customerIds.length)],
        external_order_id: `ORD-${100000 + i}`,
        order_date: new Date(now - daysAgo * 86400000).toISOString(),
        total_amount: randomBetween(1200, 18000),
        currency: 'PKR',
        status,
      };
    });
    const { error: orderError } = await supabase.from('seller_orders').insert(orderRows);
    if (orderError) throw orderError;
    console.log(`Inserted ${orderRows.length} orders.`);
  }

  console.log('\nDone. Demo seller:', seller.business_name, seller.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
