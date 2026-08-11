import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, assertCanManage } from "@/lib/user-scope";

/** GET — get single user */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const caller = await getSessionUser();
  if (!caller) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const targetId = parseInt(id);
  const target = await assertCanManage(caller, targetId);
  if (!target) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      username: true,
      fullName: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      country: true,
      countryCode: true,
      timezone: true,
      timeFormat: true,
      role: true,
      status: true,
      avatarUrl: true,
      lastLogin: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ success: true, data: user });
}

/** PUT — update user (role, status, name) */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const caller = await getSessionUser();
  if (!caller) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const targetId = parseInt(id);
  const target = await assertCanManage(caller, targetId);
  if (!target) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    firstName,
    lastName,
    fullName,
    phoneNumber,
    country,
    countryCode,
    timezone,
    timeFormat,
    role,
    status,
  } = body as {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phoneNumber?: string;
    country?: string;
    countryCode?: string;
    timezone?: string;
    timeFormat?: string;
    role?: "admin" | "user";
    status?: "active" | "inactive" | "closed";
  };

  const data: Record<string, unknown> = {};
  if (typeof firstName === "string") data.firstName = firstName;
  if (typeof lastName === "string") data.lastName = lastName;
  if (typeof fullName === "string") data.fullName = fullName;
  if (typeof phoneNumber === "string") data.phoneNumber = phoneNumber;
  if (typeof country === "string") data.country = country;
  if (typeof countryCode === "string") data.countryCode = countryCode;
  if (typeof timezone === "string") data.timezone = timezone;
  if (typeof timeFormat === "string") data.timeFormat = timeFormat;

  // Only super admins can change roles (and only between admin/user)
  if (role) {
    if (caller.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Only super admins can change roles" },
        { status: 403 }
      );
    }
    if (!["admin", "user"].includes(role)) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }
    data.role = role;
  }

  if (status) {
    if (!["active", "inactive", "closed"].includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
    }
    data.status = status;
    data.isActive = status === "active";
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data,
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      fullName: true,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

/** DELETE — close user account (soft close) */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const caller = await getSessionUser();
  if (!caller) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const targetId = parseInt(id);
  if (targetId === caller.id) {
    return NextResponse.json(
      { success: false, error: "You cannot close your own account here" },
      { status: 400 }
    );
  }

  const target = await assertCanManage(caller, targetId);
  if (!target) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  await prisma.user.update({
    where: { id: targetId },
    data: { status: "closed", isActive: false },
  });

  return NextResponse.json({ success: true });
}
