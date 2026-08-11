import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { getSessionUser, canMutate } from "@/lib/user-scope";

export async function POST(req: NextRequest) {
  try {
    const caller = await getSessionUser();
    if (!caller) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!canMutate(caller.role)) return Response.json({ error: "Forbidden: read-only role" }, { status: 403 });

    const body = await req.json();
    const { action, contactIds, listId, tagIds } = body;

    if (!action || !Array.isArray(contactIds) || contactIds.length === 0) {
      return Response.json({ success: false, error: "action and contactIds required" }, { status: 400 });
    }

    const ids = contactIds.map((i: number) => Number(i));

    switch (action) {
      case "delete":
        await prisma.contact.deleteMany({ where: { id: { in: ids } } });
        break;

      case "unsubscribe":
        await prisma.contact.updateMany({
          where: { id: { in: ids } },
          data: { isUnsubscribed: true },
        });
        break;

      case "resubscribe":
        await prisma.contact.updateMany({
          where: { id: { in: ids } },
          data: { isUnsubscribed: false },
        });
        break;

      case "block":
        await prisma.contact.updateMany({
          where: { id: { in: ids } },
          data: { isBlocked: true },
        });
        break;

      case "unblock":
        await prisma.contact.updateMany({
          where: { id: { in: ids } },
          data: { isBlocked: false },
        });
        break;

      case "addToList":
        if (!listId) return Response.json({ success: false, error: "listId required" }, { status: 400 });
        await prisma.contactListEntry.createMany({
          data: ids.map((cid) => ({ listId: Number(listId), contactId: cid })),
          skipDuplicates: true,
        });
        const count = await prisma.contactListEntry.count({ where: { listId: Number(listId) } });
        await prisma.contactList.update({ where: { id: Number(listId) }, data: { contactCount: count } });
        break;

      case "removeFromList":
        if (!listId) return Response.json({ success: false, error: "listId required" }, { status: 400 });
        await prisma.contactListEntry.deleteMany({
          where: { listId: Number(listId), contactId: { in: ids } },
        });
        const remaining = await prisma.contactListEntry.count({ where: { listId: Number(listId) } });
        await prisma.contactList.update({ where: { id: Number(listId) }, data: { contactCount: remaining } });
        break;

      case "addTags":
        if (!Array.isArray(tagIds) || tagIds.length === 0)
          return Response.json({ success: false, error: "tagIds required" }, { status: 400 });
        const pairs: Array<{ contactId: number; tagId: number }> = [];
        for (const cid of ids) for (const tid of tagIds) pairs.push({ contactId: cid, tagId: Number(tid) });
        await prisma.contactTag.createMany({ data: pairs, skipDuplicates: true });
        break;

      default:
        return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
    }

    return Response.json({ success: true, affected: ids.length });
  } catch (error) {
    console.error("Bulk action error:", error);
    return Response.json({ success: false, error: "Bulk action failed" }, { status: 500 });
  }
}
