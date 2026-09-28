import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";

import User from "../src/models/User.js";
import CustomerProfile from "../src/models/CustomerProfile.js";
import FarmerProfile from "../src/models/FarmerProfile.js";
import Market from "../src/models/Market.js";
import Category from "../src/models/Category.js";
import Product from "../src/models/Product.js";
import PickupSlot from "../src/models/PickupSlot.js";
import Order from "../src/models/Order.js";
import Review from "../src/models/Review.js";
import Notification from "../src/models/Notification.js";
import Favorite from "../src/models/Favorite.js";

const CATEGORIES = ["Vegetables", "Fruits", "Dairy", "Baked Goods", "Herbs", "Organic Produce", "Seasonal Produce", "Other"];

// Real Karachi-area coordinates used so the map demo looks plausible.
const MARKETS = [
  { name: "Clifton Sunday Market", address: "Clifton Beach Rd, Karachi", lat: 24.8138, lng: 67.0300, days: ["SUN"] },
  { name: "DHA Farmers Market", address: "Khayaban-e-Shahbaz, DHA Phase 6, Karachi", lat: 24.8010, lng: 67.0410, days: ["SAT", "SUN"] },
  { name: "Gulshan Green Bazaar", address: "Gulshan-e-Iqbal Block 5, Karachi", lat: 24.9180, lng: 67.0980, days: ["WED", "SAT"] },
  { name: "North Nazimabad Farmers Hub", address: "North Nazimabad Block H, Karachi", lat: 24.9330, lng: 67.0430, days: ["FRI", "SAT"] },
  { name: "PECHS Organic Corner", address: "Tariq Road, PECHS, Karachi", lat: 24.8700, lng: 67.0620, days: ["TUE", "SAT"] },
];

const FARMER_NAMES = [
  ["Green Valley Farms", "Ahmed Raza"],
  ["Sunrise Organic Co.", "Bilal Sheikh"],
  ["Fresh Roots Stall", "Sana Malik"],
  ["Harvest Hands", "Usman Tariq"],
  ["Golden Fields Dairy", "Ayesha Noor"],
  ["Bloom & Basket", "Fatima Zahra"],
  ["Village Basket", "Kamran Iqbal"],
  ["Nature's Nook", "Zainab Hussain"],
  ["Countryside Produce", "Hamza Sheikh"],
  ["The Herb Garden", "Maria Khan"],
  ["Riverbend Orchards", "Imran Baig"],
  ["Wholesome Harvest", "Sadia Aslam"],
];

const PRODUCT_TEMPLATES = {
  Vegetables: ["Tomatoes", "Spinach", "Carrots", "Bell Peppers", "Okra", "Cauliflower", "Potatoes", "Onions"],
  Fruits: ["Mangoes", "Bananas", "Guava", "Oranges", "Watermelon", "Papaya", "Apples", "Grapes"],
  Dairy: ["Farm Fresh Milk", "Homemade Yogurt", "Paneer", "Butter", "Cream"],
  "Baked Goods": ["Sourdough Bread", "Banana Bread", "Whole Wheat Rolls", "Cookies"],
  Herbs: ["Mint", "Coriander", "Basil", "Curry Leaves"],
  "Organic Produce": ["Organic Kale", "Organic Lettuce", "Organic Eggs", "Organic Honey"],
  "Seasonal Produce": ["Winter Squash", "Seasonal Berries", "Fresh Peas"],
  Other: ["Homemade Pickles", "Fresh Juice", "Dried Fruits"],
};

const UNITS = { Vegetables: "kg", Fruits: "kg", Dairy: "liter", "Baked Goods": "piece", Herbs: "bunch", "Organic Produce": "kg", "Seasonal Produce": "kg", Other: "jar" };

// Same curated Unsplash photography the frontend falls back to for any
// product with no farmer-uploaded image (see client/src/utils/imageAssets.js).
// Duplicated here (rather than imported) since server and client are
// independent apps with their own dependency trees.
const CATEGORY_IMAGE_URLS = {
  Vegetables: "https://images.unsplash.com/photo-1705928629040-c701a1e70531?fm=jpg&q=75&w=1200&auto=format&fit=crop",
  Fruits: "https://images.unsplash.com/photo-1753379038304-03b314ed8901?fm=jpg&q=75&w=1200&auto=format&fit=crop",
  "Baked Goods": "https://images.unsplash.com/photo-1668724063394-dc6716fc6bd6?fm=jpg&q=75&w=1200&auto=format&fit=crop",
  Dairy: "https://images.unsplash.com/photo-1705928629040-c701a1e70531?fm=jpg&q=75&w=1200&auto=format&fit=crop",
  Herbs: "https://images.unsplash.com/photo-1705928629040-c701a1e70531?fm=jpg&q=75&w=1200&auto=format&fit=crop",
  "Organic Produce": "https://images.unsplash.com/photo-1759003103614-11427d946af0?fm=jpg&q=75&w=1200&auto=format&fit=crop",
  "Seasonal Produce": "https://images.unsplash.com/photo-1753379038304-03b314ed8901?fm=jpg&q=75&w=1200&auto=format&fit=crop",
  Other: "https://images.unsplash.com/photo-1705928629040-c701a1e70531?fm=jpg&q=75&w=1200&auto=format&fit=crop",
};

const CUSTOMER_NAMES = [
  ["Ali Raza", "ali.raza@example.com"],
  ["Sara Ahmed", "sara.ahmed@example.com"],
  ["Bilal Hassan", "bilal.hassan@example.com"],
  ["Nida Farooq", "nida.farooq@example.com"],
  ["Omar Siddiqui", "omar.siddiqui@example.com"],
  ["Hira Javed", "hira.javed@example.com"],
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function run() {
  await connectDB();
  console.log("Connected. Wiping existing collections...");

  await Promise.all([
    User.deleteMany({}),
    CustomerProfile.deleteMany({}),
    FarmerProfile.deleteMany({}),
    Market.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    PickupSlot.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
    Notification.deleteMany({}),
    Favorite.deleteMany({}),
  ]);

  console.log("Seeding categories...");
  const categoryDocs = await Category.insertMany(
    CATEGORIES.map((name) => ({ name, slug: name.toLowerCase().replace(/\s+/g, "-") }))
  );
  const catByName = Object.fromEntries(categoryDocs.map((c) => [c.name, c]));

  console.log("Seeding markets...");
  const marketDocs = await Market.insertMany(
    MARKETS.map((m) => ({
      name: m.name,
      address: m.address,
      operatingDays: m.days,
      openTime: "08:00",
      closeTime: "13:00",
      latitude: m.lat,
      longitude: m.lng,
      mapProvider: "OSM",
      description: `${m.name} brings together local growers for fresh, seasonal produce.`,
      imageUrl: "https://images.unsplash.com/photo-1705928629040-c701a1e70531?fm=jpg&q=75&w=1200&auto=format&fit=crop",
      isActive: true,
    }))
  );

  console.log("Seeding demo accounts (admin/customer/farmer)...");
  const demoPasswordHash = await User.hashPassword("Password123!");

  const admin = await User.create({
    name: "Platform Admin",
    email: "admin@marketlink.test",
    passwordHash: demoPasswordHash,
    role: "ADMIN",
    status: "ACTIVE",
  });

  const demoCustomerUser = await User.create({
    name: "Demo Customer",
    email: "customer@marketlink.test",
    passwordHash: demoPasswordHash,
    role: "CUSTOMER",
    contactNumber: "0300-1234567",
    address: "House 12, Street 4, DHA Phase 5, Karachi",
    status: "ACTIVE",
  });
  const demoCustomerProfile = await CustomerProfile.create({ user: demoCustomerUser._id });

  const demoFarmerUser = await User.create({
    name: "Ahmed Raza",
    email: "farmer@marketlink.test",
    passwordHash: demoPasswordHash,
    role: "FARMER",
    contactNumber: "0301-7654321",
    address: "Green Valley Farms, Super Highway, Karachi",
    status: "ACTIVE",
  });
  const demoFarmerProfile = await FarmerProfile.create({
    user: demoFarmerUser._id,
    stallName: "Green Valley Farms",
    contactPerson: "Ahmed Raza",
    about: "Family-run stall specializing in vegetables and seasonal fruit, selling fresh every week.",
    markets: [marketDocs[0]._id, marketDocs[1]._id],
    pickupWindows: [
      { day: "SAT", startTime: "08:00", endTime: "12:00", cutoffMinutesBefore: 180 },
      { day: "SUN", startTime: "08:00", endTime: "12:00", cutoffMinutesBefore: 180 },
    ],
    location: { address: marketDocs[0].address, latitude: marketDocs[0].latitude, longitude: marketDocs[0].longitude },
  });

  console.log("Seeding additional customers...");
  const customerUsers = [];
  for (const [name, email] of CUSTOMER_NAMES) {
    const u = await User.create({
      name,
      email,
      passwordHash: demoPasswordHash,
      role: "CUSTOMER",
      contactNumber: `03${randInt(10, 99)}-${randInt(1000000, 9999999)}`,
      address: `House ${randInt(1, 200)}, ${rand(["Gulshan", "DHA", "Clifton", "North Nazimabad", "PECHS"])}, Karachi`,
      status: "ACTIVE",
    });
    await CustomerProfile.create({ user: u._id });
    customerUsers.push(u);
  }
  const allCustomerUsers = [demoCustomerUser, ...customerUsers];

  console.log("Seeding additional farmers...");
  const farmerProfiles = [demoFarmerProfile];
  for (const [stallName, contactPerson] of FARMER_NAMES) {
    if (stallName === "Green Valley Farms") continue; // already created as demo farmer
    const email = `${contactPerson.toLowerCase().replace(/\s+/g, ".")}@marketlink.test`;
    const u = await User.create({
      name: contactPerson,
      email,
      passwordHash: demoPasswordHash,
      role: "FARMER",
      contactNumber: `03${randInt(10, 99)}-${randInt(1000000, 9999999)}`,
      address: `${stallName}, Karachi`,
      status: "ACTIVE",
    });
    const assignedMarkets = [rand(marketDocs)._id];
    const fp = await FarmerProfile.create({
      user: u._id,
      stallName,
      contactPerson,
      about: `${stallName} brings fresh, locally-sourced goods to the market every week.`,
      markets: assignedMarkets,
      pickupWindows: [
        { day: rand(["SAT", "SUN", "WED", "FRI"]), startTime: "08:00", endTime: "12:00", cutoffMinutesBefore: 120 },
      ],
      location: { address: `${stallName} area, Karachi`, latitude: 24.86 + Math.random() * 0.15, longitude: 67.0 + Math.random() * 0.15 },
    });
    farmerProfiles.push(fp);
  }

  console.log("Seeding products (40+)...");
  const productDocs = [];
  for (const farmer of farmerProfiles) {
    const market = rand(marketDocs.filter((m) => farmer.markets.some((fm) => fm.equals(m._id)))) || marketDocs[0];
    const numProducts = randInt(3, 5);
    const categoriesForFarmer = [rand(CATEGORIES), rand(CATEGORIES)];
    for (let i = 0; i < numProducts; i++) {
      const categoryName = rand(categoriesForFarmer);
      const productName = rand(PRODUCT_TEMPLATES[categoryName]);
      const qty = randInt(0, 40);
      productDocs.push({
        farmer: farmer._id,
        market: market._id,
        category: catByName[categoryName]._id,
        name: productName,
        description: `Fresh ${productName.toLowerCase()} sourced directly from ${farmer.stallName}.`,
        price: randInt(50, 600),
        unit: UNITS[categoryName],
        quantityAvailable: qty,
        imageUrl: CATEGORY_IMAGE_URLS[categoryName],
        status: qty === 0 ? "SOLD_OUT" : "AVAILABLE",
      });
    }
  }
  const createdProducts = await Product.insertMany(productDocs);
  console.log(`Created ${createdProducts.length} products.`);

  console.log("Seeding pickup slots...");
  const slotDocs = [];
  const dayIndexByCode = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  for (const farmer of farmerProfiles) {
    for (const window of farmer.pickupWindows) {
      for (let weekOffset = 0; weekOffset < 3; weekOffset++) {
        const today = new Date();
        const targetDow = dayIndexByCode[window.day];
        const diff = (targetDow - today.getDay() + 7) % 7 + weekOffset * 7;
        const date = new Date(today);
        date.setDate(today.getDate() + diff);
        date.setHours(0, 0, 0, 0);

        const [ch, cm] = window.startTime.split(":").map(Number);
        const cutoff = new Date(date);
        cutoff.setHours(ch, cm, 0, 0);
        cutoff.setMinutes(cutoff.getMinutes() - window.cutoffMinutesBefore);

        slotDocs.push({
          farmer: farmer._id,
          market: farmer.markets[0],
          date,
          startTime: window.startTime,
          endTime: window.endTime,
          cutoffAt: cutoff,
          capacity: 20,
          bookedCount: 0,
        });
      }
    }
  }
  const createdSlots = await PickupSlot.insertMany(slotDocs, { ordered: false }).catch((e) => {
    // Duplicate slot keys across overlapping weeks are safe to ignore.
    return e.insertedDocs || [];
  });

  console.log("Seeding a handful of orders + reviews so dashboards aren't empty...");
  const demoFarmerSlot = await PickupSlot.findOne({ farmer: demoFarmerProfile._id }).sort({ date: 1 });
  const demoFarmerProducts = createdProducts.filter((p) => p.farmer.equals(demoFarmerProfile._id));

  const orderStatuses = ["PLACED", "ACCEPTED", "READY_FOR_PICKUP", "COMPLETED", "COMPLETED", "CANCELLED"];
  for (let i = 0; i < 6 && demoFarmerSlot && demoFarmerProducts.length; i++) {
    const customer = rand(allCustomerUsers);
    const product = rand(demoFarmerProducts);
    const quantity = randInt(1, 3);
    const status = orderStatuses[i];
    const order = await Order.create({
      customer: customer._id,
      farmer: demoFarmerProfile._id,
      market: demoFarmerSlot.market,
      pickupSlot: demoFarmerSlot._id,
      items: [
        {
          product: product._id,
          nameSnapshot: product.name,
          priceSnapshot: product.price,
          unitSnapshot: product.unit,
          quantity,
          lineTotal: product.price * quantity,
        },
      ],
      totalAmount: product.price * quantity,
      status,
      statusHistory: [{ status, note: "Seeded demo order." }],
    });

    if (status === "COMPLETED") {
      await Review.create({
        customer: customer._id,
        targetType: "PRODUCT",
        product: product._id,
        order: order._id,
        rating: randInt(3, 5),
        comment: rand([
          "Really fresh, will order again!",
          "Great quality for the price.",
          "Exactly as described, happy with the pickup experience.",
          "Good produce, friendly farmer at pickup.",
        ]),
      });
    }
  }

  console.log("Seeding a couple of notifications for the demo customer...");
  await Notification.insertMany([
    { user: demoCustomerUser._id, type: "ORDER_ACCEPTED", message: "Your order from Green Valley Farms was accepted.", link: "/orders" },
    { user: demoCustomerUser._id, type: "PRODUCT_RESTOCKED", message: "Tomatoes from Green Valley Farms are back in stock.", link: "/products" },
  ]);

  console.log("\nSeed complete.");
  console.log("Demo accounts (all use password: Password123!):");
  console.log(`  Admin:    ${admin.email}`);
  console.log(`  Customer: ${demoCustomerUser.email}`);
  console.log(`  Farmer:   ${demoFarmerUser.email}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
