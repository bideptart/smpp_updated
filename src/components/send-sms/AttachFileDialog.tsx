"use client";

import { useRef, useState, DragEvent, ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Paperclip, UploadCloud, X, FileIcon, Loader2 } from "lucide-react";

const ACCEPT =
  ".jpg,.jpeg,.gif,.png,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.vcf";
const ALLOWED_EXTS = [
  ".jpg", ".jpeg", ".gif", ".png",
  ".pdf", ".txt", ".csv",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".vcf",
];
const MAX_SIZE = 10 * 1024 * 1024;

export interface AttachedFile {
  id: string;
  filename: string;
  size: number;
  url: string;
}

interface AttachFileDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAttached: (file: AttachedFile) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getExt(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export default function AttachFileDialog({
  open,
  onOpenChange,
  onAttached,
}: AttachFileDialogProps) {
  const [selected, setSelected] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(file: File): string | null {
    const ext = getExt(file.name);
    if (!ALLOWED_EXTS.includes(ext)) {
      return `File type ${ext || "(unknown)"} is not supported`;
    }
    if (file.size > MAX_SIZE) {
      return "File exceeds 10 MB limit";
    }
    return null;
  }

  function handleFileSelected(file: File) {
    const err = validate(file);
    if (err) {
      toast.error(err);
      return;
    }
    setSelected(file);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    // Reset so selecting same file again works
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  async function handleUpload() {
    if (!selected) {
      toast.error("Please choose a file first");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selected);
      const res = await fetch("/api/attachments", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Upload failed");
        return;
      }
      toast.success("File attached");
      onAttached({
        id: json.data.id,
        filename: json.data.filename,
        size: json.data.size,
        url: json.data.url,
      });
      setSelected(null);
      onOpenChange(false);
    } catch {
      toast.error("Network error");
    } finally {
      setUploading(false);
    }
  }

  function handleClose() {
    setSelected(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl modal-card">
        <DialogHeader className="modal-header">
          <div className="modal-header-icon">
            <Paperclip className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="modal-title">Attach a file</DialogTitle>
            <p className="modal-subtitle">
              Include a downloadable link in your SMS
            </p>
          </div>
        </DialogHeader>

        <div className="modal-body">
          <div
            className={`attach-dropzone ${dragActive ? "attach-dropzone--active" : ""} ${selected ? "attach-dropzone--has-file" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !selected && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              onChange={handleInputChange}
              className="attach-input-hidden"
            />

            {!selected ? (
              <>
                <UploadCloud className="attach-dropzone-icon" />
                <p className="attach-dropzone-title">
                  <span className="attach-browse-link">Browse files...</span> or drag and drop
                </p>
                <p className="attach-dropzone-sub">
                  Supports .jpg, .jpeg, .gif, .png, .pdf, .txt, .csv, .doc, .docx, .xls, .xlsx, .ppt, .pptx &amp; .vcf file formats
                </p>
              </>
            ) : (
              <div className="attach-selected">
                <div className="attach-selected-icon">
                  <FileIcon className="h-6 w-6" />
                </div>
                <div className="attach-selected-info">
                  <strong className="attach-selected-name">{selected.name}</strong>
                  <span className="attach-selected-size">{formatSize(selected.size)}</span>
                </div>
                <button
                  type="button"
                  className="attach-selected-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(null);
                  }}
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <ul className="attach-notes">
            <li>You can upload files that are up to 10 MB in size.</li>
            <li>A clickable hyperlink will be included in your SMS where recipients can view / download your file.</li>
            <li>Attachments will be stored on SMSLocal&apos;s servers.</li>
          </ul>
        </div>

        <DialogFooter className="modal-footer">
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            <X className="mr-1.5 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!selected || uploading} className="modal-save-btn">
            {uploading ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadCloud className="mr-1.5 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
