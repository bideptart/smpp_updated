// Common consumer/personal email domains — rejected for "admin" role signups
// that require a business email.
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "pm.me",
  "zoho.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "yandex.com",
  "yandex.ru",
  "rediffmail.com",
  "inbox.com",
]);

export function isBusinessEmail(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return false;
  return !PERSONAL_EMAIL_DOMAINS.has(domain);
}

// Maximum number of super admins allowed
export const MAX_SUPER_ADMINS = 5;

export type SignupRole = "user" | "admin";

export function generateUsername(firstName: string, lastName: string, email: string): string {
  const base = (firstName + lastName).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (base.length >= 3) return base + Math.random().toString(36).slice(2, 6);
  // fallback
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") + Math.random().toString(36).slice(2, 6);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must include a number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a special character";
  return null;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  // Accept +[1-3 digit country code][4-14 digits] with optional spaces/dashes
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^\+?[1-9]\d{6,15}$/.test(cleaned);
}