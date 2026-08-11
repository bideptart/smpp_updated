import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getSessionUser, assertCanManage } from "@/lib/user-scope";
import { sendMail, resetEmail, isEmailConfigured } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Trigger a password-reset flow for a user.
 * Generates a fresh invite token (re-uses the invitation mechanism for password reset)
 * and returns the URL so the caller can send it to the user.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const caller = await getSessionUser();
  if (!caller) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const targetId = parseInt(id);
  const target = await assertCanManage(caller, targetId);
  if (!target) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

  const rl = rateLimit(`reset-password:${targetId}`, 3, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many reset attempts for this user. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const targetUser = await prisma.user.update({
    where: { id: targetId },
    data: { inviteToken: token, inviteExpiresAt: expires },
    select: { email: true, firstName: true, fullName: true },
  });

  const host = req.headers.get("host") || "v2.app.smslocal.com";
  const protocol = req.headers.get("x-forwarded-proto") || "http";
  const resetUrl = `${protocol}://${host}/invite/${token}?reset=1`;

  // resetUrl is returned to the caller below regardless of email delivery
  // -- never log it, it's a bearer credential for resetting the password.

  let emailSent = false;
  let emailError: string | undefined;
  if (isEmailConfigured() && targetUser.email) {
    const tpl = resetEmail({
      to: targetUser.email,
      resetUrl,
      userName: targetUser.firstName || targetUser.fullName || "",
    });
    const result = await sendMail({
      to: targetUser.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });
    emailSent = result.ok;
    emailError = result.error;
  }

  return NextResponse.json({
    success: true,
    data: { resetUrl, emailSent, emailError },
  });
}
