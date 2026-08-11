import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  MAX_SUPER_ADMINS,
  isBusinessEmail,
  generateUsername,
  validatePassword,
  validateEmail,
  validatePhone,
} from "@/lib/auth-helpers";

/**
 * Create a super admin. Restricted to:
 *   - Existing super admins only (via session), OR
 *   - Bootstrap mode: if no super admins exist yet and caller provides
 *     BOOTSTRAP_SUPER_ADMIN_KEY in the X-Bootstrap-Key header.
 *
 * Hard limit: MAX_SUPER_ADMINS (5 currently, configurable later).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, password, country, countryCode, phoneNumber } = body;

    // Permission check
    const session = await auth();
    const callerRole = (session?.user as { role?: string } | undefined)?.role;

    const superAdminCount = await prisma.user.count({ where: { role: "super_admin" } });

    const bootstrapKey = req.headers.get("x-bootstrap-key");
    const allowedBootstrap =
      superAdminCount === 0 &&
      process.env.BOOTSTRAP_SUPER_ADMIN_KEY &&
      bootstrapKey === process.env.BOOTSTRAP_SUPER_ADMIN_KEY;

    if (!allowedBootstrap && callerRole !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Only super admins can create super admins" },
        { status: 403 }
      );
    }

    // Capacity check
    if (superAdminCount >= MAX_SUPER_ADMINS) {
      return NextResponse.json(
        {
          success: false,
          error: `Super admin limit reached (${MAX_SUPER_ADMINS}). Raise MAX_SUPER_ADMINS to add more.`,
        },
        { status: 409 }
      );
    }

    // Validate
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ success: false, error: "First and last name required" }, { status: 400 });
    }
    if (!email || !validateEmail(email)) {
      return NextResponse.json({ success: false, error: "Valid email required" }, { status: 400 });
    }
    if (!isBusinessEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Super admins require a business email" },
        { status: 400 }
      );
    }
    const pwdErr = validatePassword(password || "");
    if (pwdErr) return NextResponse.json({ success: false, error: pwdErr }, { status: 400 });
    if (!country?.trim()) {
      return NextResponse.json({ success: false, error: "Country required" }, { status: 400 });
    }
    if (!phoneNumber || !validatePhone(phoneNumber)) {
      return NextResponse.json({ success: false, error: "Valid phone number required" }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: generateUsername(firstName, lastName, email),
        email: email.toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        passwordHash,
        country: country.trim(),
        countryCode: countryCode?.trim() || null,
        phoneNumber: phoneNumber.replace(/\s+/g, ""),
        role: "super_admin",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        remaining: MAX_SUPER_ADMINS - (superAdminCount + 1),
      },
    });
  } catch (err: unknown) {
    console.error("[register/super-admin] error:", err);
    const message = err instanceof Error ? err.message : "Failed to create super admin";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  const count = await prisma.user.count({ where: { role: "super_admin" } });
  return NextResponse.json({
    success: true,
    data: { count, max: MAX_SUPER_ADMINS, remaining: MAX_SUPER_ADMINS - count },
  });
}
