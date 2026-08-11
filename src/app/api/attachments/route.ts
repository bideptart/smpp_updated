import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getSessionUser, canMutate } from "@/lib/user-scope";

const ALLOWED_EXTS = [
  ".jpg", ".jpeg", ".gif", ".png",
  ".pdf", ".txt", ".csv",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".vcf",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const UPLOAD_DIR = path.join(process.cwd(), "public", "attachments");

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return NextResponse.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "File exceeds 10 MB limit" },
        { status: 400 }
      );
    }

    // Validate extension
    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `File type ${ext} not supported` },
        { status: 400 }
      );
    }

    // Create upload dir if needed
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const id = crypto.randomBytes(8).toString("hex");
    const safeName = `${id}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Build public URL
    const host = req.headers.get("host") || "v2.app.smslocal.com";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const url = `${protocol}://${host}/attachments/${safeName}`;

    return NextResponse.json({
      success: true,
      data: {
        id,
        filename: originalName,
        storedAs: safeName,
        size: file.size,
        type: file.type,
        url,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[attachments/upload] error:", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Increase body size limit (Next.js 16 App Router uses route segment config)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
