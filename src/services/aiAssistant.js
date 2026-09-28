import Market from "../models/Market.js";
import FarmerProfile from "../models/FarmerProfile.js";
import Product from "../models/Product.js";

/**
 * Retrieves real matching data from the database for a user question.
 * This is used BOTH as the always-on grounding context passed to a
 * real LLM call (when AI_API_KEY is configured) AND as the entire
 * answer engine when no key is set - so the assistant can never
 * invent inventory or availability either way, per the SRS.
 */
async function retrieveContext(question) {
  const q = question.toLowerCase();

  const [markets, farmers, products] = await Promise.all([
    Market.find({ isActive: true }).limit(5),
    FarmerProfile.find().limit(5).populate("markets", "name"),
    Product.find({ status: "AVAILABLE" })
      .populate("farmer", "stallName")
      .populate("market", "name")
      .populate("category", "name")
      .limit(200),
  ]);

  const words = q.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const matchedProducts = products.filter((p) => {
    const haystack = `${p.name} ${p.category?.name || ""} ${p.farmer?.stallName || ""}`.toLowerCase();
    return words.some((w) => haystack.includes(w));
  });

  return { markets, farmers, products, matchedProducts };
}

function formatMarketAnswer(markets) {
  if (!markets.length) return "There are no active markets on the platform right now.";
  const lines = markets.map(
    (m) => `${m.name} (${m.address}) - open ${m.operatingDays.join("/")}, ${m.openTime}-${m.closeTime}`
  );
  return `Here are the current markets:\n${lines.join("\n")}`;
}

function formatProductAnswer(matched) {
  if (!matched.length) return "I couldn't find any in-stock product matching that in our current listings.";
  const lines = matched
    .slice(0, 8)
    .map((p) => `${p.name} - Rs. ${p.price}/${p.unit}, from ${p.farmer?.stallName || "a local farmer"} at ${p.market?.name || "a local market"} (${p.quantityAvailable} ${p.unit} left)`);
  return `Here's what I found in stock:\n${lines.join("\n")}`;
}

function formatFarmerAnswer(farmers) {
  if (!farmers.length) return "There are no farmers listed on the platform yet.";
  const lines = farmers.map(
    (f) => `${f.stallName} - sells at ${f.markets.map((m) => m.name).join(", ") || "a local market"}`
  );
  return `Here are some farmers currently on MarketLink:\n${lines.join("\n")}`;
}

function fallbackAnswer(question, context) {
  const q = question.toLowerCase();

  if (context.matchedProducts.length && /find|where|available|have|got|stock/.test(q)) {
    return formatProductAnswer(context.matchedProducts);
  }
  if (/market|timing|open|hours|when/.test(q) && !context.matchedProducts.length) {
    return formatMarketAnswer(context.markets);
  }
  if (/farmer|stall|seller|vendor/.test(q)) {
    return formatFarmerAnswer(context.farmers);
  }
  if (/pickup|slot|reserve|pre-?order/.test(q)) {
    return "You can reserve a pickup slot from a farmer's profile page: choose a market, browse their products, add items to your cart, then pick an available date and time before placing your pre-order. Payment happens in person at pickup - MarketLink doesn't process online payments.";
  }
  if (context.matchedProducts.length) {
    return formatProductAnswer(context.matchedProducts);
  }
  return "I can help you find markets, farmers, and products, and explain how pickup and pre-orders work. Try asking things like \"where can I find tomatoes?\" or \"which markets are open on Saturday?\"";
}

async function callConfiguredAI(question, context) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;

  const contextSummary = {
    markets: context.markets.map((m) => ({ name: m.name, days: m.operatingDays, hours: `${m.openTime}-${m.closeTime}` })),
    matchedProducts: context.matchedProducts.slice(0, 10).map((p) => ({
      name: p.name, price: p.price, unit: p.unit, quantityAvailable: p.quantityAvailable,
      farmer: p.farmer?.stallName, market: p.market?.name,
    })),
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system:
          "You are the MarketLink assistant for a farmers-market pickup app. Only use the JSON context you are given below to answer - never invent products, prices, or availability that aren't in it. If the context doesn't contain an answer, say so plainly.\n\nContext:\n" +
          JSON.stringify(contextSummary),
        messages: [{ role: "user", content: question }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.content?.find((c) => c.type === "text")?.text;
    return text || null;
  } catch {
    return null;
  }
}

export async function answerQuestion(question) {
  const context = await retrieveContext(question);
  const aiAnswer = await callConfiguredAI(question, context);
  return {
    answer: aiAnswer || fallbackAnswer(question, context),
    usedAI: !!aiAnswer,
  };
}
