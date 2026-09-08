import { timingSafeEqual } from "crypto";

export function authorizeBillingIntegration(request: Request, source: "bookeasy" | "dailym") {
  const configured = process.env[`${source.toUpperCase()}_BILLING_API_KEY`]?.trim();
  const authorization = request.headers.get("authorization") || "";
  const received = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!configured || configured.length < 32 || !received) return false;
  const expectedBuffer = Buffer.from(configured);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
