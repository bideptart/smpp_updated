import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import {
  getSessionUser,
  scopeForCaller,
  creatableRoles,
} from "@/lib/user-scope";
import { isBusinessEmail, validateEmail } from "@/lib/auth-helpers";
import { sendMail, inviteEmail, isEmailConfigured } from "@/lib/email";

/** GET — list team members visible to the caller */
export async function GET() {
  const caller = await getSessionUser();
  if (!caller) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const where = scopeForCaller(caller);

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      username: true,
      fullName: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      lastLogin: true,
      createdAt: true,
      ownerId: true,
    },
  });

  return NextResponse.json({
    success: true,
    data: users,
    meta: {
      callerRole: caller.role,
      canCreate: creatableRoles(caller.role),
    },
  });
}

/** POST — invite a new user or admin */
export async function POST(req: NextRequest) {
  const caller = await getSessionUser();
  if (!caller) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { email, role } = body as { email?: string; role?: "admin" | "user" };

  if (!email || !validateEmail(email)) {
    return NextResponse.json({ success: false, error: "Valid email required" }, { status: 400 });
  }

  const allowed = creatableRoles(caller.role);
  const targetRole = role || "user";
  if (!allowed.includes(targetRole)) {
    return NextResponse.json(
      { success: false, error: `You cannot invite a ${targetRole}` },
      { status: 403 }
    );
  }

  // Admin role requires business email
  if (targetRole === "admin" && !isBusinessEmail(email)) {
    return NextResponse.json(
      { success: false, error: "Admin accounts require a business email" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const tempUsername = email.split("@")[0] + "_" + Math.random().toString(36).slice(2, 6);

  // Ownership rules:
  //   - Admin invites a user → owner = admin (so they appear in admin's list)
  //   - Super admin invites an admin → owner = super admin (tracks who created it)
  //   - Super admin invites a user → owner = null (standalone, visible to super admin)
  let ownerId: number | null;
  if (caller.role === "admin") {
    ownerId = caller.id;
  } else if (caller.role === "super_admin" && targetRole === "admin") {
    ownerId = caller.id;
  } else {
    ownerId = null; // super_admin → user stays standalone
  }

  const created = await prisma.user.create({
    data: {
      username: tempUsername,
      email: email.toLowerCase(),
      fullName: email, // placeholder — set on accept
      passwordHash: "",
      role: targetRole,
      status: "invited",
      ownerId,
      inviteToken: token,
      inviteExpiresAt: expires,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      inviteToken: true,
    },
  });

  const host = req.headers.get("host") || "v2.app.smslocal.com";
  const protocol = req.headers.get("x-forwarded-proto") || "http";
  const inviteUrl = `${protocol}://${host}/invite/${token}`;

  // Fetch inviter name for the email
  const inviter = await prisma.user.findUnique({
    where: { id: caller.id },
    select: { fullName: true, firstName: true, email: true },
  });
  const invitedByName =
    inviter?.fullName || inviter?.firstName || inviter?.email || "A teammate";

  // inviteUrl is returned to the caller below regardless of email delivery
  // -- never log it, it's a bearer credential for accepting the invite.

  let emailSent = false;
  let emailError: string | undefined;
  if (isEmailConfigured()) {
    const tpl = inviteEmail({
      to: created.email!,
      inviteUrl,
      role: targetRole,
      invitedByName,
    });
    const result = await sendMail({
      to: created.email!,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    emailSent = result.ok;
    emailError = result.error;
  }

  return NextResponse.json({
    success: true,
    data: {
      id: created.id,
      email: created.email,
      role: created.role,
      status: created.status,
      inviteUrl,
      emailSent,
      emailError,
    },
  });
}
