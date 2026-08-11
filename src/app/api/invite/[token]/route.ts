import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { validatePassword } from "@/lib/auth-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/** GET — validate token + return invitation info */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const rl = rateLimit(`invite-lookup:${getClientIp(req)}`, 20, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { token } = await ctx.params;
  if (!token) return NextResponse.json({ success: false, error: "Missing token" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      inviteExpiresAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: "Invalid or expired invitation" }, { status: 404 });
  }

  if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
    return NextResponse.json(
      { success: false, error: "This invitation has expired. Ask the admin to resend." },
      { status: 410 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      isReset: user.status === "active", // if active + token exists, it's a password reset
    },
  });
}

/** POST — accept invitation (set name + password) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const rl = rateLimit(`invite-accept:${getClientIp(req)}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { token } = await ctx.params;
  if (!token) return NextResponse.json({ success: false, error: "Missing token" }, { status: 400 });

  const body = await req.json();
  const { firstName, lastName, password } = body as {
    firstName?: string;
    lastName?: string;
    password?: string;
  };

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json(
      { success: false, error: "First and last name required" },
      { status: 400 }
    );
  }
  const pwdErr = validatePassword(password || "");
  if (pwdErr) return NextResponse.json({ success: false, error: pwdErr }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    select: { id: true, email: true, status: true, inviteExpiresAt: true },
  });

  if (!user) {
    return NextResponse.json({ success: false, error: "Invalid token" }, { status: 404 });
  }
  if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
    return NextResponse.json({ success: false, error: "Token expired" }, { status: 410 });
  }

  const passwordHash = await bcrypt.hash(password!, 10);

  // For password resets the status stays "active"; for invites it becomes "active".
  const nextStatus = user.status === "closed" ? "closed" : "active";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      username: `${firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}_${user.id}`,
      passwordHash,
      status: nextStatus,
      isActive: nextStatus === "active",
      emailVerified: true,
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  return NextResponse.json({
    success: true,
    data: { email: user.email },
  });
}
