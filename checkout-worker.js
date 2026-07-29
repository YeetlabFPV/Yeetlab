const ALLOWED_ORIGINS = new Set([
  "https://yeetlabfpv.com",
  "https://www.yeetlabfpv.com",
  "https://yeetlabfpv.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

const SUCCESS_URL =
  "https://yeetlabfpv.com/success.html?session_id={CHECKOUT_SESSION_ID}";
const CANCEL_URL = "https://yeetlabfpv.com/cancel.html";
const STRIPE_CHECKOUT_URL = "https://api.stripe.com/v1/checkout/sessions";
const SHIPPING_RATE = "shr_1Ty7k00LBr9BqjupCxKHr2hb";
const MAX_QUANTITY = 20;

const PRICE_IDS = {
  frame: "price_1Ty7hM0LBr9BqjupNPzReUbs",
  arm: "price_1Ty9M80LBr9BqjupvjVW8ZQp",
  "top-plate": "price_1Ty9NL0LBr9BqjupZtJJCXcc",
  "bottom-plate": "price_1Ty9O60LBr9BqjupBVZqMtri",
  "base-mid-plate": "price_1Ty9RB0LBr9BqjupvIYkK5zr",
  "arm-locking-plate": "price_1Ty9SD0LBr9Bqjupt30sIvY5",
};

const DELIVERY_COUNTRIES = [
  "AC", "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AT",
  "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI",
  "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY",
  "BZ", "CA", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO",
  "CR", "CV", "CW", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC",
  "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FO", "FR", "GA",
  "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ",
  "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HN", "HR", "HT", "HU", "ID",
  "IE", "IL", "IM", "IN", "IO", "IQ", "IS", "IT", "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KR", "KW", "KY", "KZ", "LA", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "MA", "MC", "MD", "ME", "MF",
  "MG", "MK", "ML", "MN", "MO", "MQ", "MR", "MS", "MT", "MU", "MV", "MW",
  "MX", "MY", "MZ", "NA", "NC", "NE", "NG", "NI", "NL", "NO", "NP", "NR",
  "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN",
  "PR", "PS", "PT", "PY", "QA", "RE", "RO", "RS", "RW", "SA", "SB", "SC",
  "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SZ", "TA", "TC", "TD", "TF", "TG", "TH", "TJ", "TK",
  "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "US",
  "UY", "UZ", "VA", "VC", "VE", "VG", "VN", "VU", "WF", "WS", "XK", "YE",
  "YT", "ZA", "ZM", "ZW",
];

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function jsonResponse(body, status = 200, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

function validateItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("Expected items to be an array.");
  }

  const validatedItems = items.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid item.");
    }

    const { key, quantity } = item;

    if (!Object.hasOwn(PRICE_IDS, key)) {
      throw new Error(`Unknown product key: ${String(key)}`);
    }

    if (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) {
      throw new Error(`Invalid quantity for ${key}.`);
    }

    return { key, quantity };
  });

  const selectedItems = validatedItems.filter((item) => item.quantity > 0);

  if (selectedItems.length === 0) {
    throw new Error("Select at least one item.");
  }

  return selectedItems;
}

async function createCheckoutSession(request, env, origin) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400, origin);
  }

  let items;
  try {
    items = validateItems(payload.items);
  } catch (error) {
    return jsonResponse({ error: error.message }, 400, origin);
  }

  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse({ error: "Checkout is not configured." }, 500, origin);
  }

  const lineItems = items.map((item) => ({
    price: PRICE_IDS[item.key],
    quantity: item.quantity,
  }));

  const body = new URLSearchParams({
    mode: "payment",
    success_url: SUCCESS_URL,
    cancel_url: CANCEL_URL,
    "shipping_options[0][shipping_rate]": SHIPPING_RATE,
    "shipping_address_collection[allowed_countries][0]": DELIVERY_COUNTRIES[0],
    allow_promotion_codes: "true",
  });

  DELIVERY_COUNTRIES.forEach((country, index) => {
    body.set(`shipping_address_collection[allowed_countries][${index}]`, country);
  });

  lineItems.forEach((item, index) => {
    body.set(`line_items[${index}][price]`, item.price);
    body.set(`line_items[${index}][quantity]`, String(item.quantity));
  });

  const stripeResponse = await fetch(STRIPE_CHECKOUT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const stripeBody = await stripeResponse.json().catch(() => ({}));

  if (!stripeResponse.ok || !stripeBody.url) {
    const message =
      stripeBody?.error?.message || "Stripe could not create the checkout session.";
    return jsonResponse({ error: message }, 502, origin);
  }

  return jsonResponse({ url: stripeBody.url }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return jsonResponse({ error: "Origin is not allowed." }, 403, origin);
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return jsonResponse({ ok: true, service: "yeetlab-checkout" }, 200, origin);
    }

    if (request.method === "POST" && url.pathname === "/checkout") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return jsonResponse({ error: "Origin is not allowed." }, 403, origin);
      }

      return createCheckoutSession(request, env, origin);
    }

    return jsonResponse({ error: "Not found." }, 404, origin);
  },
};
