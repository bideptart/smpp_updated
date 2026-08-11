import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SAMPLE_CATEGORIES = [
  { name: "Greetings", color: "emerald" },
  { name: "Reminders", color: "amber" },
  { name: "Marketing", color: "indigo" },
  { name: "Transactional", color: "blue" },
  { name: "Support", color: "rose" },
  { name: "Notifications", color: "violet" },
  { name: "Verification", color: "sky" },
  { name: "Events", color: "fuchsia" },
  { name: "Appointments", color: "teal" },
  { name: "Surveys", color: "orange" },
];

const SAMPLE_TEMPLATES = [
  // ─── Greetings (5) ───────────────────────────────
  {
    category: "Greetings",
    name: "Welcome message",
    content:
      "Hi {firstName}, welcome to {company}! We're excited to have you on board. Reply HELP for assistance.",
  },
  {
    category: "Greetings",
    name: "Happy birthday",
    content:
      "🎉 Happy Birthday {firstName}! Wishing you a wonderful year ahead. Enjoy a special 20% discount today. Use code: BDAY20",
  },
  {
    category: "Greetings",
    name: "Festival greeting",
    content:
      "Hi {firstName}, wishing you and your family a very happy festive season! ✨ Thank you for being part of our journey.",
  },
  {
    category: "Greetings",
    name: "New year wishes",
    content:
      "🎊 Dear {firstName}, wishing you a prosperous New Year filled with success and happiness! Thank you for being with us.",
  },
  {
    category: "Greetings",
    name: "Anniversary greeting",
    content:
      "Hi {firstName}, congratulations on your anniversary with us! It's been a pleasure serving you. Enjoy 15% off as our thank-you gift.",
  },

  // ─── Reminders (5) ──────────────────────────────
  {
    category: "Reminders",
    name: "Appointment reminder",
    content:
      "Hi {firstName}, your appointment is confirmed for tomorrow at 10:00 AM. Reply C to cancel or R to reschedule.",
  },
  {
    category: "Reminders",
    name: "Payment due",
    content:
      "Dear {firstName}, this is a reminder that your payment is due. Please settle it at your earliest convenience to avoid service interruption.",
  },
  {
    category: "Reminders",
    name: "Event reminder",
    content:
      "Hi {firstName}, a friendly reminder about our upcoming event tomorrow at 6 PM. We look forward to seeing you there!",
  },
  {
    category: "Reminders",
    name: "Subscription renewal",
    content:
      "Hi {firstName}, your subscription is due for renewal in 3 days. Renew now to avoid any interruption in service.",
  },
  {
    category: "Reminders",
    name: "Document submission",
    content:
      "Dear {firstName}, kindly submit the required documents by end of this week. Contact us at support if you need help.",
  },

  // ─── Marketing (5) ──────────────────────────────
  {
    category: "Marketing",
    name: "Flash sale",
    content:
      "🔥 Flash Sale! Hi {firstName}, get 30% OFF on your next order. Limited time offer. Shop now: [link]",
  },
  {
    category: "Marketing",
    name: "New product launch",
    content:
      "Hey {firstName}! 🎉 We just launched something amazing. Be among the first to check it out. Visit us today!",
  },
  {
    category: "Marketing",
    name: "Exclusive offer",
    content:
      "Hi {firstName}, an exclusive deal just for you — 25% off your next purchase. Use code VIP25. Valid till Sunday.",
  },
  {
    category: "Marketing",
    name: "Referral program",
    content:
      "Hi {firstName}, refer a friend and both get ₹500 off! Share your code: REF{firstName}. Start referring now.",
  },
  {
    category: "Marketing",
    name: "Seasonal sale",
    content:
      "☀️ Summer Sale is here {firstName}! Flat 40% off on selected items. Sale ends Sunday — don't miss out!",
  },

  // ─── Transactional (5) ──────────────────────────
  {
    category: "Transactional",
    name: "OTP verification",
    content:
      "Your verification code is 123456. Do not share this code with anyone. It will expire in 10 minutes.",
  },
  {
    category: "Transactional",
    name: "Order confirmation",
    content:
      "Hi {firstName}, your order has been confirmed. You'll receive a shipping update shortly. Thank you for shopping with us!",
  },
  {
    category: "Transactional",
    name: "Order shipped",
    content:
      "Good news {firstName}! Your order has been shipped and will reach you soon. Track your package in your account.",
  },
  {
    category: "Transactional",
    name: "Delivery notification",
    content:
      "Hi {firstName}, your package has been delivered. We hope you love it! Share your feedback with us.",
  },
  {
    category: "Transactional",
    name: "Payment received",
    content:
      "Hi {firstName}, we've received your payment successfully. Thank you! A receipt has been sent to {email}.",
  },

  // ─── Support (5) ────────────────────────────────
  {
    category: "Support",
    name: "Ticket received",
    content:
      "Hi {firstName}, we've received your request and our team is working on it. You'll hear back within 24 hours.",
  },
  {
    category: "Support",
    name: "Feedback request",
    content:
      "Hi {firstName}, we'd love to hear your feedback. Your opinion helps us improve. Reply with your thoughts!",
  },
  {
    category: "Support",
    name: "Account update",
    content:
      "Hi {firstName}, your account details have been updated successfully. If you didn't request this, contact support immediately.",
  },
  {
    category: "Support",
    name: "Issue resolved",
    content:
      "Hi {firstName}, your support ticket has been resolved. Please reply if you need further assistance. Thank you!",
  },
  {
    category: "Support",
    name: "Callback scheduled",
    content:
      "Hi {firstName}, your callback is scheduled. Our team will reach you at {phoneNumber} within 2 hours.",
  },

  // ─── Notifications (5) ──────────────────────────
  {
    category: "Notifications",
    name: "New login alert",
    content:
      "Hi {firstName}, new sign-in detected on your account. If this wasn't you, secure your account immediately.",
  },
  {
    category: "Notifications",
    name: "Password changed",
    content:
      "Hi {firstName}, your password was changed successfully. If you did not make this change, contact support right away.",
  },
  {
    category: "Notifications",
    name: "Profile updated",
    content:
      "Hi {firstName}, your profile has been updated. Check your account to review the changes.",
  },
  {
    category: "Notifications",
    name: "Low balance alert",
    content:
      "Hi {firstName}, your account balance is running low. Please recharge to avoid service interruption.",
  },
  {
    category: "Notifications",
    name: "Service maintenance",
    content:
      "Hi {firstName}, scheduled maintenance is planned tonight from 2 AM–4 AM. Service may be temporarily unavailable.",
  },

  // ─── Verification (5) ──────────────────────────
  {
    category: "Verification",
    name: "Email verification",
    content:
      "Hi {firstName}, please verify your email {email} using this code: 987654. Valid for 15 minutes.",
  },
  {
    category: "Verification",
    name: "Phone verification",
    content:
      "Your phone verification code is 456789. Enter this on the app to confirm your number. Do not share with anyone.",
  },
  {
    category: "Verification",
    name: "Two-factor code",
    content:
      "Your two-factor authentication code is 741852. This code expires in 5 minutes. Never share it.",
  },
  {
    category: "Verification",
    name: "Login OTP",
    content:
      "Hi {firstName}, your login OTP is 369258. Use it to complete sign-in. Do not share it with anyone.",
  },
  {
    category: "Verification",
    name: "Transaction OTP",
    content:
      "Your transaction OTP is 852147. If you did not initiate this transaction, block your card immediately.",
  },

  // ─── Events (5) ─────────────────────────────────
  {
    category: "Events",
    name: "Event invitation",
    content:
      "Hi {firstName}, you're invited to our exclusive event on Friday at 7 PM. RSVP to confirm your attendance.",
  },
  {
    category: "Events",
    name: "Webinar invitation",
    content:
      "Hi {firstName}, join our free webinar this Saturday at 4 PM. Register now — limited seats available!",
  },
  {
    category: "Events",
    name: "Conference reminder",
    content:
      "Hi {firstName}, the conference begins in 2 days. Don't forget to bring your ID and confirmation email.",
  },
  {
    category: "Events",
    name: "Meetup announcement",
    content:
      "🤝 Hey {firstName}, our community meetup is on Sunday at 5 PM. Food, fun, and networking — see you there!",
  },
  {
    category: "Events",
    name: "Event ticket confirmation",
    content:
      "Hi {firstName}, your event ticket is confirmed. Entry code: EVT-{firstName}-2026. Show this at the gate.",
  },

  // ─── Appointments (5) ──────────────────────────
  {
    category: "Appointments",
    name: "Appointment booked",
    content:
      "Hi {firstName}, your appointment is booked. Our team will contact you shortly to confirm the time slot.",
  },
  {
    category: "Appointments",
    name: "Appointment rescheduled",
    content:
      "Hi {firstName}, your appointment has been rescheduled. New slot details have been sent to {email}.",
  },
  {
    category: "Appointments",
    name: "Appointment cancelled",
    content:
      "Hi {firstName}, your appointment has been cancelled as per your request. Rebook anytime via our app.",
  },
  {
    category: "Appointments",
    name: "Doctor appointment",
    content:
      "Hi {firstName}, your doctor's appointment is confirmed for tomorrow 11 AM. Please arrive 15 minutes early.",
  },
  {
    category: "Appointments",
    name: "Service appointment",
    content:
      "Hi {firstName}, our technician will visit you tomorrow between 10 AM–12 PM for scheduled service.",
  },

  // ─── Surveys (5) ───────────────────────────────
  {
    category: "Surveys",
    name: "Customer satisfaction survey",
    content:
      "Hi {firstName}, rate your recent experience 1–5 by replying to this SMS. Your feedback helps us improve!",
  },
  {
    category: "Surveys",
    name: "Product feedback",
    content:
      "Hi {firstName}, how's your new purchase? We'd love a quick review. Reply with your thoughts.",
  },
  {
    category: "Surveys",
    name: "Service rating",
    content:
      "Hi {firstName}, rate our service from 1–10. Your rating helps us serve you better. Thank you!",
  },
  {
    category: "Surveys",
    name: "Poll invitation",
    content:
      "Hey {firstName}, we're running a quick poll. Your vote matters! Reply YES or NO to participate.",
  },
  {
    category: "Surveys",
    name: "NPS survey",
    content:
      "Hi {firstName}, on a scale of 0–10, how likely are you to recommend us to a friend? Reply with a number.",
  },
];

async function main() {
  console.log("Seeding sample templates...");
  console.log(`Total: ${SAMPLE_CATEGORIES.length} categories, ${SAMPLE_TEMPLATES.length} templates per customer`);

  const customers = await prisma.company.findMany({
    where: { type: "customer" },
  });

  if (customers.length === 0) {
    console.log("No customer companies found. Skipping.");
    return;
  }

  for (const customer of customers) {
    console.log(`\nProcessing customer: ${customer.name} (id=${customer.id})`);

    // Create categories
    const catMap: Record<string, number> = {};
    for (const cat of SAMPLE_CATEGORIES) {
      const existing = await prisma.templateCategory.findFirst({
        where: { customerId: customer.id, name: cat.name },
      });
      if (existing) {
        catMap[cat.name] = existing.id;
        console.log(`  Category exists: ${cat.name}`);
      } else {
        const created = await prisma.templateCategory.create({
          data: { customerId: customer.id, name: cat.name, color: cat.color },
        });
        catMap[cat.name] = created.id;
        console.log(`  Created category: ${cat.name}`);
      }
    }

    // Create templates
    let created = 0, skipped = 0;
    for (const tpl of SAMPLE_TEMPLATES) {
      const existing = await prisma.template.findFirst({
        where: { customerId: customer.id, name: tpl.name },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.template.create({
        data: {
          customerId: customer.id,
          categoryId: catMap[tpl.category],
          name: tpl.name,
          content: tpl.content,
        },
      });
      created++;
    }
    console.log(`  Templates: ${created} created, ${skipped} already existed`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
