"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, X, Check } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface TemplateCategory {
  id: number;
  name: string;
  color: string;
  _count?: { templates: number };
}

interface Template {
  id: number;
  name: string;
  content: string;
  categoryId: number | null;
  category?: { id: number; name: string; color: string } | null;
}

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: number;
  onSelect: (template: Template) => void;
}

export default function TemplatePickerDialog({
  open,
  onOpenChange,
  customerId,
  onSelect,
}: TemplatePickerDialogProps) {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const { data: catData } = useSWR(
    open && customerId ? `/api/template-categories?customerId=${customerId}` : null,
    fetcher
  );
  const { data: tplData } = useSWR(
    open && customerId ? `/api/templates?customerId=${customerId}` : null,
    fetcher
  );

  const categories: TemplateCategory[] = catData?.data || [];
  const templates: Template[] = tplData?.data || [];

  const filtered = templates.filter((t) => {
    if (activeCat === "all") return true;
    if (activeCat === "uncat") return !t.categoryId;
    return String(t.categoryId) === activeCat;
  }).filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.content.toLowerCase().includes(q)
    );
  });

  function handleSelect(t: Template) {
    onSelect(t);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl modal-card">
        <DialogHeader className="modal-header">
          <div className="modal-header-icon">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="modal-title">Insert template</DialogTitle>
            <p className="modal-subtitle">Choose a saved template to use as your message</p>
          </div>
        </DialogHeader>

        <div className="modal-body tpl-picker-body">
          <div className="tpl-picker-search">
            <Search className="tpl-picker-search-icon" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="tpl-picker-search-input"
            />
          </div>

          <div className="tpl-picker-layout">
            <aside className="tpl-picker-sidebar">
              <button
                type="button"
                className={`tpl-picker-cat ${activeCat === "all" ? "tpl-picker-cat--active" : ""}`}
                onClick={() => setActiveCat("all")}
              >
                <span>All templates</span>
                <span className="tpl-picker-cat-count">{templates.length}</span>
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`tpl-picker-cat ${activeCat === String(c.id) ? "tpl-picker-cat--active" : ""}`}
                  onClick={() => setActiveCat(String(c.id))}
                >
                  <span>{c.name}</span>
                  <span className="tpl-picker-cat-count">{c._count?.templates ?? 0}</span>
                </button>
              ))}
              <button
                type="button"
                className={`tpl-picker-cat ${activeCat === "uncat" ? "tpl-picker-cat--active" : ""}`}
                onClick={() => setActiveCat("uncat")}
              >
                <span>Uncategorized</span>
                <span className="tpl-picker-cat-count">
                  {templates.filter((t) => !t.categoryId).length}
                </span>
              </button>
            </aside>

            <div className="tpl-picker-list">
              {filtered.length === 0 ? (
                <div className="tpl-picker-empty">
                  <FileText className="h-8 w-8 text-slate-300" />
                  <p>No templates found</p>
                  <small>Create templates from the Templates menu</small>
                </div>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="tpl-picker-item"
                    onClick={() => handleSelect(t)}
                  >
                    <div className="tpl-picker-item-header">
                      <strong>{t.name}</strong>
                      {t.category && (
                        <span className="tpl-picker-item-cat">{t.category.name}</span>
                      )}
                    </div>
                    <p className="tpl-picker-item-content">{t.content}</p>
                    <div className="tpl-picker-item-footer">
                      <Check className="h-3.5 w-3.5" />
                      <span>Use this template</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="modal-footer">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-1.5 h-4 w-4" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
