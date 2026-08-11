"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar as CalIcon } from "lucide-react";
import CalendarView, { type PreviewEvent } from "./CalendarView";

export default function CalendarPreviewDialog({
  open,
  onOpenChange,
  customerId,
  previewEvent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: number | null;
  previewEvent?: PreviewEvent | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl modal-card">
        <DialogHeader className="modal-header">
          <div className="modal-header-icon">
            <CalIcon className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="modal-title">Preview in calendar</DialogTitle>
            <p className="modal-subtitle">Scheduled SMS overview</p>
          </div>
        </DialogHeader>

        <div className="modal-body">
          {open && (
            <CalendarView customerId={customerId} previewEvent={previewEvent} />
          )}
        </div>

        <DialogFooter className="modal-footer">
          <Button onClick={() => onOpenChange(false)} className="modal-save-btn">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
