import Order, { ORDER_TRANSITIONS } from "../models/Order.js";
import Product from "../models/Product.js";
import PickupSlot from "../models/PickupSlot.js";
import FarmerProfile from "../models/FarmerProfile.js";
import Notification from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";
import { getPagination, buildMeta } from "../utils/pagination.js";

/**
 * POST /api/orders
 * Creates a pre-order for ONE farmer's products against ONE pickup slot.
 * Every validation happens here, server-side - the frontend cart is
 * only ever a suggestion:
 *   - each product actually belongs to the claimed farmer
 *   - each product has enough quantityAvailable
 *   - the pickup slot belongs to that farmer, isn't full, isn't past cutoff
 * Stock is decremented and the slot's bookedCount incremented atomically
 * enough for a demo app (a transaction would be used at real scale, but
 * MongoDB standalone/no-replica-set instances - the common local dev
 * setup - don't support multi-document transactions).
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { farmerId, pickupSlotId, items } = req.body; // items: [{ productId, quantity }]

  if (!farmerId || !pickupSlotId || !Array.isArray(items) || items.length === 0) {
    throw new AppError("farmerId, pickupSlotId and at least one item are required.", 400);
  }

  const slot = await PickupSlot.findById(pickupSlotId);
  if (!slot || !slot.farmer.equals(farmerId)) {
    throw new AppError("Pickup slot not found for this farmer.", 404);
  }
  if (slot.cutoffAt <= new Date()) {
    throw new AppError("The order cutoff time for this pickup slot has passed.", 400);
  }
  if (slot.bookedCount >= slot.capacity) {
    throw new AppError("This pickup slot is fully booked. Please choose another.", 400);
  }

  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productById = Object.fromEntries(products.map((p) => [p._id.toString(), p]));

  let totalAmount = 0;
  const orderItems = [];
  for (const { productId, quantity } of items) {
    const product = productById[productId];
    if (!product) throw new AppError(`Product ${productId} not found.`, 404);
    if (!product.farmer.equals(farmerId)) {
      throw new AppError(`${product.name} does not belong to the selected farmer.`, 400);
    }
    if (quantity < 1) throw new AppError("Quantity must be at least 1.", 400);
    if (product.quantityAvailable < quantity) {
      throw new AppError(`Only ${product.quantityAvailable} ${product.unit} of ${product.name} left in stock.`, 400);
    }
    const lineTotal = product.price * quantity;
    totalAmount += lineTotal;
    orderItems.push({
      product: product._id,
      nameSnapshot: product.name,
      priceSnapshot: product.price,
      unitSnapshot: product.unit,
      quantity,
      lineTotal,
    });
  }

  // Decrement stock now that every line has been validated.
  for (const { productId, quantity } of items) {
    const product = productById[productId];
    product.quantityAvailable -= quantity;
    if (product.quantityAvailable <= 0) product.status = "SOLD_OUT";
    await product.save();
  }

  slot.bookedCount += 1;
  await slot.save();

  const order = await Order.create({
    customer: req.user._id,
    farmer: farmerId,
    market: slot.market,
    pickupSlot: slot._id,
    items: orderItems,
    totalAmount,
    status: "PLACED",
    statusHistory: [{ status: "PLACED" }],
  });

  const farmerProfile = await FarmerProfile.findById(farmerId).populate("user", "_id");
  await Notification.create({
    user: farmerProfile.user._id,
    type: "ORDER_PLACED",
    message: `New pre-order received (Rs. ${totalAmount}).`,
    link: `/farmer/orders/${order._id}`,
  });

  res.status(201).json({ order });
});

export const listMyOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { page, limit, skip } = getPagination(req, 10);
  const filter = { customer: req.user._id };
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("farmer", "stallName")
      .populate("market", "name address")
      .populate("pickupSlot", "date startTime endTime")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({ orders, meta: buildMeta(total, page, limit) });
});

export const listFarmerOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const { page, limit, skip } = getPagination(req, 10);
  const profile = await FarmerProfile.findOne({ user: req.user._id });
  if (!profile) throw new AppError("Farmer profile not found.", 404);

  const filter = { farmer: profile._id };
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("customer", "name contactNumber")
      .populate("pickupSlot", "date startTime endTime")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({ orders, meta: buildMeta(total, page, limit) });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("customer", "name contactNumber address")
    .populate("farmer", "stallName contactPerson")
    .populate("market", "name address")
    .populate("pickupSlot", "date startTime endTime");
  if (!order) throw new AppError("Order not found.", 404);

  const farmerProfile = req.user.role === "FARMER" ? await FarmerProfile.findOne({ user: req.user._id }) : null;
  const isOwner = order.customer._id.equals(req.user._id);
  const isFarmerOwner = farmerProfile && order.farmer._id.equals(farmerProfile._id);
  const isAdmin = req.user.role === "ADMIN";
  if (!isOwner && !isFarmerOwner && !isAdmin) {
    throw new AppError("You do not have permission to view this order.", 403);
  }

  res.json({ order });
});

async function restoreStockForOrder(order) {
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { quantityAvailable: item.quantity },
      $set: { status: "AVAILABLE" },
    });
  }
  await PickupSlot.findByIdAndUpdate(order.pickupSlot, { $inc: { bookedCount: -1 } });
}

/**
 * PUT /api/orders/:id/cancel
 * Customer-initiated cancellation. Blocked once the pickup slot's
 * cutoff has passed, and only legal from PLACED/ACCEPTED.
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("pickupSlot");
  if (!order) throw new AppError("Order not found.", 404);
  if (!order.customer.equals(req.user._id)) throw new AppError("You can only cancel your own orders.", 403);
  if (!ORDER_TRANSITIONS[order.status]?.includes("CANCELLED")) {
    throw new AppError(`Cannot cancel an order that is ${order.status}.`, 400);
  }
  if (order.pickupSlot.cutoffAt <= new Date()) {
    throw new AppError("The cutoff time for this order's pickup slot has passed; it can no longer be cancelled.", 400);
  }

  await restoreStockForOrder(order);
  order.status = "CANCELLED";
  order.statusHistory.push({ status: "CANCELLED", note: req.body.reason || "Cancelled by customer." });
  order.cancelReason = req.body.reason;
  await order.save();

  res.json({ order });
});

/**
 * PUT /api/orders/:id/modify
 * Customer-initiated quantity change, only before cutoff and only
 * while PLACED. Re-validates stock for the delta.
 */
export const modifyOrder = asyncHandler(async (req, res) => {
  const { items } = req.body; // [{ productId, quantity }]
  const order = await Order.findById(req.params.id).populate("pickupSlot");
  if (!order) throw new AppError("Order not found.", 404);
  if (!order.customer.equals(req.user._id)) throw new AppError("You can only modify your own orders.", 403);
  if (order.status !== "PLACED") throw new AppError("Only orders still in PLACED status can be modified.", 400);
  if (order.pickupSlot.cutoffAt <= new Date()) {
    throw new AppError("The cutoff time has passed; this order can no longer be modified.", 400);
  }
  if (!Array.isArray(items) || !items.length) throw new AppError("At least one item is required.", 400);

  // Restore old stock, then re-validate and apply the new quantities -
  // simplest correct way to handle both increases and decreases.
  await restoreStockForOrder(order);

  let totalAmount = 0;
  const newItems = [];
  for (const { productId, quantity } of items) {
    const product = await Product.findById(productId);
    if (!product || !product.farmer.equals(order.farmer)) {
      throw new AppError("Invalid product for this order.", 400);
    }
    if (quantity < 1) throw new AppError("Quantity must be at least 1.", 400);
    if (product.quantityAvailable < quantity) {
      throw new AppError(`Only ${product.quantityAvailable} ${product.unit} of ${product.name} left.`, 400);
    }
    product.quantityAvailable -= quantity;
    if (product.quantityAvailable <= 0) product.status = "SOLD_OUT";
    await product.save();

    const lineTotal = product.price * quantity;
    totalAmount += lineTotal;
    newItems.push({
      product: product._id,
      nameSnapshot: product.name,
      priceSnapshot: product.price,
      unitSnapshot: product.unit,
      quantity,
      lineTotal,
    });
  }

  await PickupSlot.findByIdAndUpdate(order.pickupSlot._id, { $inc: { bookedCount: 1 } });

  order.items = newItems;
  order.totalAmount = totalAmount;
  order.statusHistory.push({ status: "PLACED", note: "Order modified by customer." });
  await order.save();

  res.json({ order });
});

/**
 * PUT /api/orders/:id/status
 * Farmer-driven status changes (ACCEPTED, DECLINED, READY_FOR_PICKUP,
 * COMPLETED). Transitions are checked against ORDER_TRANSITIONS so an
 * invalid jump (e.g. PLACED -> COMPLETED) is rejected regardless of
 * what the client sends.
 */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id).populate("pickupSlot");
  if (!order) throw new AppError("Order not found.", 404);

  const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
  if (!farmerProfile || !order.farmer.equals(farmerProfile._id)) {
    throw new AppError("You can only manage your own orders.", 403);
  }

  const allowedNext = ORDER_TRANSITIONS[order.status] || [];
  if (!allowedNext.includes(status)) {
    throw new AppError(`Cannot move an order from ${order.status} to ${status}.`, 400);
  }

  if (status === "DECLINED" || status === "CANCELLED") {
    await restoreStockForOrder(order);
  }

  order.status = status;
  order.statusHistory.push({ status, note });
  await order.save();

  const notifTypeByStatus = {
    ACCEPTED: "ORDER_ACCEPTED",
    DECLINED: "ORDER_DECLINED",
    READY_FOR_PICKUP: "ORDER_READY",
    COMPLETED: "ORDER_COMPLETED",
    CANCELLED: "ORDER_CANCELLED",
  };
  const messageByStatus = {
    ACCEPTED: "Your order has been accepted by the farmer.",
    DECLINED: "Your order was declined by the farmer.",
    READY_FOR_PICKUP: "Your order is ready for pickup!",
    COMPLETED: "Your order has been marked complete. Thanks for shopping local!",
    CANCELLED: "Your order was cancelled by the farmer.",
  };
  if (notifTypeByStatus[status]) {
    await Notification.create({
      user: order.customer,
      type: notifTypeByStatus[status],
      message: messageByStatus[status],
      link: `/orders/${order._id}`,
    });
  }

  res.json({ order });
});
