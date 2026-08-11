"use client";

import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  X,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// A single-message status only has to be bucketed into the same four-way
// split a campaign already returns from its own endpoint -- doing it here
// keeps /api/sms/messages/[messageId]/status a plain status lookup, reusable
// elsewhere, instead of baking this dialog's bucketing into it.
function bucketSingleStatus(status: string | undefined) {
  const pending = status === "queued" || status === "sending" ? 1 : 0;
  const sent = status === "submitted" || status === "sent" ? 1 : 0;
  const delivered = status === "delivered" ? 1 : 0;
  const failed = status === "failed" ? 1 : 0;
  return { pending, sent, delivered, failed, done: pending === 0 && !!status };
}

interface SendProgressDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId?: number | null;
  messageId?: string | null;
  total: number;
}

export default function SendProgressDialog({
  open,
  onOpenChange,
  campaignId,
  messageId,
  total,
}: SendProgressDialogProps) {
  const { data: campaignData } = useSWR(
    open && campaignId ? `/api/campaigns/${campaignId}/progress` : null,
    fetcher,
    { refreshInterval: (d) => (d?.data?.done ? 0 : 2000) }
  );
  const { data: messageData } = useSWR(
    open && messageId ? `/api/sms/messages/${messageId}/status` : null,
    fetcher,
    { refreshInterval: (d) => (bucketSingleStatus(d?.data?.status).done ? 0 : 2000) }
  );

  const progress = campaignId
    ? campaignData?.data
    : messageId
    ? bucketSingleStatus(messageData?.data?.status)
    : undefined;
  const pending = progress?.pending ?? total;
  const sent = progress?.sent ?? 0;
  const delivered = progress?.delivered ?? 0;
  const failed = progress?.failed ?? 0;
  const done = progress?.done ?? false;
  const errorMessage = messageId ? messageData?.data?.errorMessage : null;
  const processedPct = total > 0 ? Math.round(((total - pending) / total) * 100) : 0;
  const allFailed = done && failed > 0 && sent === 0 && delivered === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md modal-card" showCloseButton={done}>
        <DialogHeader className="modal-header">
          <div className="modal-header-icon">
            {done ? (
              allFailed ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <DialogTitle className="modal-title">
                {done ? "Send complete" : "Sending"}
              </DialogTitle>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  done
                    ? allFailed
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {!done && <Radio className="h-2.5 w-2.5 animate-pulse" />}
                {done ? (allFailed ? "Failed" : "Completed") : "Live"}
              </span>
            </div>
            <p className="modal-subtitle">
              {done
                ? total === 1
                  ? "The message has been processed."
                  : `All ${total.toLocaleString()} messages have been processed.`
                : "Dispatching to the vendor at the account's allowed rate — large batches take time."}
            </p>
          </div>
        </DialogHeader>

        <div className="modal-body space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Progress</span>
              <span>{processedPct}%</span>
            </div>
            {/* No width transition here on purpose: a single message can
                resolve in well under a second, and animating a bar from 0
                to 100 on every poll tick (plus a fresh mount on each new
                send) reads as a flicker rather than progress. Snapping
                straight to the true value is more honest and less jumpy. */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${
                  done ? (allFailed ? "bg-red-500" : "bg-emerald-500") : "bg-blue-500"
                }`}
                style={{ width: `${processedPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Clock className="h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <div className="text-xs text-amber-700">Pending</div>
                <div className="text-lg font-semibold leading-tight text-amber-700">
                  {pending.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <Send className="h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <div className="text-xs text-blue-700">Sent to vendor</div>
                <div className="text-lg font-semibold leading-tight text-blue-700">
                  {sent.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <div className="text-xs text-emerald-700">Delivered</div>
                <div className="text-lg font-semibold leading-tight text-emerald-700">
                  {delivered.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3">
              <XCircle className="h-4 w-4 shrink-0 text-red-600" />
              <div>
                <div className="text-xs text-red-700">Failed</div>
                <div className="text-lg font-semibold leading-tight text-red-700">
                  {failed.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {failed > 0 && errorMessage && (
            <p className="text-xs text-red-600">Reason: {errorMessage}</p>
          )}

          {!done && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              <X className="mr-1.5 h-4 w-4" />
              Run in background
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
