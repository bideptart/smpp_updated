import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/user-scope";
import { validatePassword } from "@/lib/auth-helpers";

/** GET — current user's profile */
export async function GET() {
  const caller = await getSessionUser();
  if (!caller) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: caller.id },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      fullName: true,
      email: true,
      emailVerified: true,
      phoneNumber: true,
      country: true,
      countryCode: true,
      timezone: true,
      timeFormat: true,
      role: true,
      status: true,
      avatarUrl: true,
      createdAt: true,
      lastLogin: true,
    },
  });
  return NextResponse.json({ success: true, data: user });
}

/** PUT — update own profile */
export async function PUT(req: NextRequest) {
  const caller = await getSessionUser();
  if (!caller) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    firstName,
    lastName,
    phoneNumber,
    country,
    countryCode,
    timezone,
    timeFormat,
    currentPassword,
    newPassword,
  } = body as {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    country?: string;
    countryCode?: string;
    timezone?: string;
    timeFormat?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const data: Record<string, unknown> = {};
  if (typeof firstName === "string") {
    data.firstName = firstName;
    if (typeof lastName === "string") data.fullName = `${firstName} ${lastName}`.trim();
  }
  if (typeof lastName === "string") {
    data.lastName = lastName;
    if (typeof firstName === "string") data.fullName = `${firstName} ${lastName}`.trim();
  }
  if (typeof phoneNumber === "string") data.phoneNumber = phoneNumber;
  if (typeof country === "string") data.country = country;
  if (typeof countryCode === "string") data.countryCode = countryCode;
  if (typeof timezone === "string") data.timezone = timezone;
  if (typeof timeFormat === "string") data.timeFormat = timeFormat;

  // Password change flow
  if (newPassword) {
    const pwdErr = validatePassword(newPassword);
    if (pwdErr) return NextResponse.json({ success: false, error: pwdErr }, { status: 400 });

    const current = await prisma.user.findUnique({
      where: { id: caller.id },
      select: { passwordHash: true },
    });
    if (!current) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // If user has a password set, require currentPassword
    if (current.passwordHash && current.passwordHash.length > 0) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: "Current password is required" },
          { status: 400 }
        );
      }
      const match = await bcrypt.compare(currentPassword, current.passwordHash);
      if (!match) {
        return NextResponse.json(
          { success: false, error: "Current password is incorrect" },
          { status: 400 }
        );
      }
    }
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const updated = await prisma.user.update({
    where: { id: caller.id },
    data,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      country: true,
      countryCode: true,
      timezone: true,
      timeFormat: true,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
