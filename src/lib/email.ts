import nodemailer from "nodemailer";

/**
 * Gmail SMTP transporter. Reads credentials from env vars so production
 * secrets never land in the repo.
 *
 *   SMTP_HOST       smtp.gmail.com
 *   SMTP_PORT       465
 *   SMTP_SECURE     true
 *   SMTP_USER       info@smslocal.com
 *   SMTP_PASS       <Gmail App Password, spaces stripped>
 *   EMAIL_FROM      "SMSLocal <info@smslocal.com>"
 *   EMAIL_REPLY_TO  info@smslocal.com
 */

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = parseInt(process.env.SMTP_PORT || "465", 10);
const secure = (process.env.SMTP_SECURE || "true").toLowerCase() === "true";
const user = process.env.SMTP_USER || "";
// Gmail app passwords are shown as 4 groups of 4 chars; strip spaces just in case.
const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

export const EMAIL_FROM =
  process.env.EMAIL_FROM || (user ? `SMSLocal <${user}>` : "");
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || user;

let cachedTransporter: nodemailer.Transporter | null = null;

export function isEmailConfigured(): boolean {
  return !!(user && pass);
}

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return cachedTransporter;
}

export interface SendMailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(args: SendMailArgs): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    console.warn("[email] SMTP not configured — skipping send to", args.to);
    return { ok: false, error: "Email not configured" };
  }
  try {
    const t = getTransporter();
    await t.sendMail({
      from: EMAIL_FROM,
      replyTo: EMAIL_REPLY_TO || undefined,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    console.error("[email] send failed:", err);
    return { ok: false, error: message };
  }
}

/* ─────────── Templates ─────────── */

function baseTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:14px;box-shadow:0 4px 16px rgba(15,23,42,0.06);overflow:hidden;">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#6366f1,#4338ca);color:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;vertical-align:middle;">
                    <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;text-align:center;line-height:40px;font-size:20px;">💬</div>
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:18px;font-weight:700;letter-spacing:-0.01em;">SMSLocal</div>
                    <div style="font-size:11px;color:#c7d2fe;text-transform:uppercase;letter-spacing:0.08em;">BSS Platform</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">
              © ${new Date().getFullYear()} SMSLocal · This email was sent from info@smslocal.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buttonHtml(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="background:linear-gradient(135deg,#6366f1,#4338ca);border-radius:9px;">
        <a href="${url}" style="display:inline-block;padding:12px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.01em;">${label}</a>
      </td>
    </tr>
  </table>`;
}

/** Invitation email */
export function inviteEmail(params: {
  to: string;
  inviteUrl: string;
  role: string;
  invitedByName: string;
}) {
  const roleLabel =
    params.role === "admin" ? "Admin" : params.role === "super_admin" ? "Super Admin" : "User";
  const body = `
    <h2 style="font-size:20px;font-weight:700;margin:0 0 12px;color:#0f172a;">You've been invited to SMSLocal</h2>
    <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 16px;">
      <strong>${params.invitedByName}</strong> invited you to join the SMSLocal workspace as a
      <strong>${roleLabel}</strong>.
    </p>
    <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 8px;">
      Click the button below to set your name and password and activate your account:
    </p>
    ${buttonHtml(params.inviteUrl, "Activate account")}
    <p style="font-size:12px;color:#64748b;margin:0 0 8px;">
      Or copy this link into your browser:
    </p>
    <p style="font-size:12px;color:#6366f1;word-break:break-all;margin:0 0 24px;">
      <a href="${params.inviteUrl}" style="color:#6366f1;">${params.inviteUrl}</a>
    </p>
    <p style="font-size:12px;color:#94a3b8;margin:0;">
      This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.
    </p>
  `;
  return {
    subject: `You've been invited to SMSLocal (${roleLabel})`,
    html: baseTemplate("SMSLocal invitation", body),
    text: `You've been invited to SMSLocal as a ${roleLabel}.\n\nActivate your account: ${params.inviteUrl}\n\nThis link expires in 7 days.`,
  };
}

/** Password reset email */
export function resetEmail(params: { to: string; resetUrl: string; userName: string }) {
  const body = `
    <h2 style="font-size:20px;font-weight:700;margin:0 0 12px;color:#0f172a;">Reset your password</h2>
    <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 16px;">
      Hi${params.userName ? ` ${params.userName}` : ""}, we received a request to reset your SMSLocal password.
    </p>
    ${buttonHtml(params.resetUrl, "Reset password")}
    <p style="font-size:12px;color:#64748b;margin:0 0 8px;">Or copy this link:</p>
    <p style="font-size:12px;color:#6366f1;word-break:break-all;margin:0 0 24px;">
      <a href="${params.resetUrl}" style="color:#6366f1;">${params.resetUrl}</a>
    </p>
    <p style="font-size:12px;color:#94a3b8;margin:0;">
      This link expires in 24 hours. If you didn't request a reset, you can ignore this email.
    </p>
  `;
  return {
    subject: "Reset your SMSLocal password",
    html: baseTemplate("Password reset", body),
    text: `Reset your SMSLocal password: ${params.resetUrl}\n\nThis link expires in 24 hours.`,
  };
}
