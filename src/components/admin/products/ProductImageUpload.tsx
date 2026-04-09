"use client";

import { useRef, useState } from "react";
import { UploadCloud, X, Loader2, AlertCircle, ImageIcon } from "lucide-react";
import { uploadProductImage } from "@/app/admin/products/actions";

interface ProductImageUploadProps {
  /** Current value of the image_url form field (empty string = no image). */
  currentUrl: string;
  /** Called with the Supabase Storage public URL after a successful upload. */
  onUpload: (url: string) => void;
  /** Called when the admin clears the current image. */
  onClear: () => void;
  /** Called whenever the uploading state changes — lets the parent disable submit. */
  onUploadingChange: (isUploading: boolean) => void;
  /** Validation error from the parent form (e.g. Zod). */
  error?: string;
}

export function ProductImageUpload({
  currentUrl,
  onUpload,
  onClear,
  onUploadingChange,
  error,
}: ProductImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setUploading = (val: boolean) => {
    setIsUploading(val);
    onUploadingChange(val);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploading(true);

    const fd = new FormData();
    fd.set("file", file);

    const result = await uploadProductImage(fd);

    if ("error" in result) {
      setUploadError(result.error);
    } else {
      onUpload(result.url);
    }

    setUploading(false);
    // Reset so the same file can be re-selected if needed (e.g. after an error)
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClear = () => {
    onClear();
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const displayError = uploadError || error;

  return (
    <div className="space-y-3">

      {/* ── Preview ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {currentUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentUrl}
                alt="תמונת מוצר"
                className="h-28 w-28 object-cover rounded-xl border border-gray-200 bg-gray-50"
              />
              <button
                type="button"
                onClick={handleClear}
                disabled={isUploading}
                aria-label="הסר תמונה"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </>
          ) : (
            <div className="h-28 w-28 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-gray-300" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* ── Upload controls ───────────────────────────────────────────────── */}
        <div className="space-y-2 pt-1">
          <label
            htmlFor="product-image-file"
            className={[
              "inline-flex items-center gap-2 h-9 px-4 rounded-xl border text-sm font-medium transition-colors",
              isUploading
                ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed pointer-events-none"
                : "bg-white border-gray-200 text-gray-700 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 cursor-pointer",
            ].join(" ")}
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isUploading ? "מעלה..." : currentUrl ? "החלף תמונה" : "בחר קובץ"}
          </label>

          <input
            id="product-image-file"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isUploading}
            onChange={handleFileChange}
            className="sr-only"
          />

          <p className="text-xs text-gray-400">JPEG, PNG, WebP · עד 5MB</p>

          {currentUrl && !isUploading && (
            <p className="text-xs text-gray-400 break-all max-w-[280px] truncate" dir="ltr">
              {currentUrl}
            </p>
          )}
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {displayError && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {displayError}
        </div>
      )}
    </div>
  );
}
