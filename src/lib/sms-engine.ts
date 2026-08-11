/**
 * SMS Engine Utilities
 * Validation, encoding detection, and ID generation for SMS processing
 */

import { countries } from "./countries";

/**
 * Validate a destination number for any country. India keeps the exact
 * strict rule this always had (10 digits, starts 6-9) for zero behavior
 * change on existing traffic; everything else gets a general E.164-shaped
 * check (8-15 digits, no leading 0) since fully validating every country's
 * numbering plan would need a real library (e.g. libphonenumber-js).
 */
export function validatePhoneNumber(phone: string): {
  valid: boolean;
  normalized: string;
  countryCode?: string;
  error?: string;
} {
  // Remove spaces, dashes, dots, parens
  let indian = phone.replace(/[\s\-().]+/g, "");

  // Strip +91, 91, or leading 0
  if (indian.startsWith("+91")) indian = indian.slice(3);
  else if (indian.startsWith("91") && indian.length === 12) indian = indian.slice(2);
  else if (indian.startsWith("0") && indian.length === 11) indian = indian.slice(1);

  if (/^[6-9]\d{9}$/.test(indian)) {
    return { valid: true, normalized: `91${indian}`, countryCode: "91" };
  }

  // Not an Indian number — re-clean from scratch (the India-prefix stripping
  // above only applies to Indian-shaped input) and apply the general rule.
  let general = phone.replace(/[\s\-().]+/g, "");
  general = general.replace(/^\+/, "").replace(/^00/, "");

  if (!/^\d{8,15}$/.test(general)) {
    return {
      valid: false,
      normalized: general,
      error: "Enter a valid number with country code (8-15 digits)",
    };
  }
  if (general.startsWith("0")) {
    return {
      valid: false,
      normalized: general,
      error: "Include the country code instead of a leading 0",
    };
  }

  // Best-effort country match (longest dial-code prefix wins) — for display
  // only, not used for routing (that matches on the normalized digits directly).
  const match = countries
    .map((c) => c.dialCode.replace("+", ""))
    .filter((dial) => general.startsWith(dial))
    .sort((a, b) => b.length - a.length)[0];

  return { valid: true, normalized: general, countryCode: match };
}

/** Detect encoding and calculate SMS parts */
export function detectEncoding(text: string): {
  encoding: "GSM7" | "UCS2";
  parts: number;
  charsPerPart: number;
  totalChars: number;
} {
  const totalChars = text.length;

  // Check if any character is outside basic ASCII (> 127 means UCS-2)
  const isUCS2 = [...text].some((ch) => ch.charCodeAt(0) > 127);

  if (isUCS2) {
    const charsPerPart = totalChars <= 70 ? 70 : 67;
    const parts = totalChars <= 70 ? 1 : Math.ceil(totalChars / 67);
    return { encoding: "UCS2", parts, charsPerPart, totalChars };
  }

  const charsPerPart = totalChars <= 160 ? 160 : 153;
  const parts = totalChars <= 160 ? 1 : Math.ceil(totalChars / 153);
  return { encoding: "GSM7", parts, charsPerPart, totalChars };
}

/** Generate a UUID-like message ID */
export function generateMessageId(): string {
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${(
    (Math.random() * 4) |
    (0 + 8)
  )
    .toString(16)}${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

/** Generate a random hex string of given length */
export function randomHex(length: number): string {
  return Array.from({ length }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

/** Generate a random alphanumeric password */
export function generatePassword(length = 8): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}
