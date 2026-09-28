import PickupSlot from "../models/PickupSlot.js";
import FarmerProfile from "../models/FarmerProfile.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/errorHandler.js";

const DAY_INDEX = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

/**
 * GET /api/pickup-slots?farmer=<id>
 * Public - customers need this to build the "select pickup date/time"
 * step of pre-order. Only returns slots that are still open (not full,
 * not past cutoff).
 */
export const listAvailableSlots = asyncHandler(async (req, res) => {
  const { farmer } = req.query;
  if (!farmer) throw new AppError("farmer query param is required.", 400);

  const slots = await PickupSlot.find({
    farmer,
    cutoffAt: { $gt: new Date() },
    $expr: { $lt: ["$bookedCount", "$capacity"] },
  }).sort({ date: 1, startTime: 1 });

  res.json({ slots });
});

/**
 * POST /api/pickup-slots/generate
 * Farmer-only. Regenerates the next N weeks of concrete slots from
 * their recurring pickupWindows. Safe to call repeatedly - existing
 * slots (matched on farmer+date+startTime) are left untouched.
 */
export const generateSlots = asyncHandler(async (req, res) => {
  const weeks = Math.min(8, Math.max(1, parseInt(req.body.weeks, 10) || 4));
  const profile = await FarmerProfile.findOne({ user: req.user._id });
  if (!profile) throw new AppError("Farmer profile not found.", 404);
  if (!profile.pickupWindows.length) {
    throw new AppError("Add at least one pickup window to your profile first.", 400);
  }

  const created = [];
  for (const window of profile.pickupWindows) {
    for (let weekOffset = 0; weekOffset < weeks; weekOffset++) {
      const today = new Date();
      const targetDow = DAY_INDEX[window.day];
      const diff = ((targetDow - today.getDay() + 7) % 7) + weekOffset * 7;
      const date = new Date(today);
      date.setDate(today.getDate() + diff);
      date.setHours(0, 0, 0, 0);

      const [ch, cm] = window.startTime.split(":").map(Number);
      const cutoff = new Date(date);
      cutoff.setHours(ch, cm, 0, 0);
      cutoff.setMinutes(cutoff.getMinutes() - window.cutoffMinutesBefore);

      try {
        const slot = await PickupSlot.create({
          farmer: profile._id,
          market: profile.markets[0],
          date,
          startTime: window.startTime,
          endTime: window.endTime,
          cutoffAt: cutoff,
          capacity: 20,
        });
        created.push(slot);
      } catch (err) {
        if (err.code !== 11000) throw err; // ignore duplicate slot, keep going
      }
    }
  }

  res.status(201).json({ created: created.length });
});

export const listMySlots = asyncHandler(async (req, res) => {
  const profile = await FarmerProfile.findOne({ user: req.user._id });
  if (!profile) throw new AppError("Farmer profile not found.", 404);
  const slots = await PickupSlot.find({ farmer: profile._id }).sort({ date: 1, startTime: 1 });
  res.json({ slots });
});

export const deleteSlot = asyncHandler(async (req, res) => {
  const profile = await FarmerProfile.findOne({ user: req.user._id });
  const slot = await PickupSlot.findById(req.params.id);
  if (!slot) throw new AppError("Slot not found.", 404);
  if (!slot.farmer.equals(profile._id)) throw new AppError("Not your slot.", 403);
  if (slot.bookedCount > 0) throw new AppError("Cannot delete a slot with existing bookings.", 400);
  await slot.deleteOne();
  res.json({ message: "Slot removed." });
});
