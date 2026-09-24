import crypto from "node:crypto";

const API_BASE = "https://api.razorpay.com/v1";

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const error = new Error("Payment service is not configured");
    error.status = 503;
    throw error;
  }
  return { keyId, keySecret };
}

export function getRazorpayKeyId() {
  return getCredentials().keyId;
}

async function razorpayRequest(path, options = {}) {
  const { keyId, keySecret } = getCredentials();
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    const error = new Error("Payment provider is temporarily unavailable");
    error.status = 502;
    throw error;
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("Payment provider could not process the request");
    error.status = 502;
    throw error;
  }
  return result;
}

export async function createRazorpayOrder({ amount, receipt }) {
  const { keyId } = getCredentials();
  const providerOrder = await razorpayRequest("/orders", {
    method: "POST",
    body: JSON.stringify({ amount, currency: "INR", receipt }),
  });
  return { providerOrder, keyId };
}

export function verifyPaymentSignature(orderId, paymentId, signature) {
  const { keySecret } = getCredentials();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  let provided;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return provided.length === expected.length && crypto.timingSafeEqual(expected, provided);
}

export async function fetchRazorpayPayment(paymentId) {
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
}

export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !Buffer.isBuffer(rawBody) || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  let provided;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return provided.length === expected.length && crypto.timingSafeEqual(expected, provided);
}
