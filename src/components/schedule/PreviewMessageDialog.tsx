"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Users, MessageSquare } from "lucide-react";

export interface PreviewRecipient {
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface PreviewMessageDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  message: string;
  recipients: PreviewRecipient[];
  encoding?: string;
  parts?: number;
  senderId?: string;
}

export default function PreviewMessageDialog({
  open,
  onOpenChange,
  message,
  recipients,
  encoding = "GSM-7",
  parts = 1,
  senderId = "SMSLCL",
}: PreviewMessageDialogProps) {
  const [msgExpanded, setMsgExpanded] = useState(false);

  const longMsg = message.length > 280;
  const visibleMsg = !longMsg || msgExpanded ? message : message.slice(0, 280) + "…";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl modal-card">
        <DialogHeader className="modal-header">
          <div className="modal-header-icon">
            <Eye className="h-5 w-5 text-white" />
          </div>
          <div>
            <DialogTitle className="modal-title">Preview message</DialogTitle>
            <p className="modal-subtitle">Review before sending</p>
          </div>
        </DialogHeader>

        <div className="modal-body preview-body">
          {/* Message card */}
          <div className="preview-message-card">
            <div className="preview-message-header">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span className="preview-message-from">From: {senderId}</span>
              <span className="preview-message-meta">
                {message.length}/{encoding === "UCS-2" ? 70 : 160} chars · {parts} part(s) · {encoding}
              </span>
            </div>
            <div className="preview-message-text">{visibleMsg}</div>
            {longMsg && (
              <button
                type="button"
                className="preview-readmore"
                onClick={() => setMsgExpanded(!msgExpanded)}
              >
                {msgExpanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>

          {/* Recipients table */}
          <div className="preview-recipients">
            <div className="preview-recipients-header">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h4>Recipients</h4>
              <span className="preview-recipients-count">{recipients.length}</span>
            </div>
            <div className="preview-recipients-list">
              {recipients.length === 0 && (
                <div className="preview-recipients-empty">No recipients selected</div>
              )}
              <table className="preview-recipients-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.slice(0, 500).map((r, i) => {
                    const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ") || "—";
                    return (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{fullName}</td>
                        <td className="font-mono text-xs">+{r.phone}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {recipients.length > 500 && (
                <div className="preview-recipients-more">
                  …and {recipients.length - 500} more recipients
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="modal-footer">
          <Button onClick={() => onOpenChange(false)} className="modal-save-btn">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
