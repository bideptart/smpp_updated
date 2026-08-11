import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  isBusinessEmail,
  generateUsername,
  validatePassword,
  validateEmail,
  validatePhone,
  type SignupRole,
} from "@/lib/auth-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  if (process.env.ENABLE_ACCOUNT_SIGNUP !== "true") {
    return Response.json({ success: false, error: "Registration is disabled" }, { status: 403 });
  }
  const rl = rateLimit(`register:${getClientIp(req)}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return Response.json(
      { success: false, error: "Too many signup attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      password,
      country,
      countryCode,
      phoneNumber,
      role,
    } = body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      password?: string;
      country?: string;
      countryCode?: string;
      phoneNumber?: string;
      role?: SignupRole;
    };

    // Validation
    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { success: false, error: "First and last name are required" },
        { status: 400 }
      );
    }
    if (!email || !validateEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }
    if (!password) {
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      );
    }
    const pwdErr = validatePassword(password);
    if (pwdErr) {
      return NextResponse.json({ success: false, error: pwdErr }, { status: 400 });
    }
    if (!country?.trim()) {
      return NextResponse.json(
        { success: false, error: "Country is required" },
        { status: 400 }
      );
    }
    if (!phoneNumber || !validatePhone(phoneNumber)) {
      return NextResponse.json(
        { success: false, error: "Valid phone number is required" },
        { status: 400 }
      );
    }

    const signupRole: SignupRole = role === "admin" ? "admin" : "user";

    // Business email required for admin role
    if (signupRole === "admin" && !isBusinessEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Admin accounts require a business email (gmail, yahoo, outlook, etc. are not allowed)",
        },
        { status: 400 }
      );
    }

    // Check email uniqueness
    const existing = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Build username
    const username = generateUsername(firstName, lastName, email);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        passwordHash,
        country: country.trim(),
        countryCode: countryCode?.trim() || null,
        phoneNumber: phoneNumber.replace(/\s+/g, ""),
        role: signupRole,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: unknown) {
    console.error("[register] error:", err);
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
