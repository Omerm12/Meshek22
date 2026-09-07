import { Info } from "lucide-react";
import { CONFIRMED_CARD_BRANDS, GENERIC_CARD_NOTICE } from "@/lib/payment/cardcom-brands";

/**
 * Compact info row shown under the online-card payment option.
 *
 * Reads exclusively from src/lib/payment/cardcom-brands.ts, the single
 * configuration source for confirmed CardCom brands, so this text can never
 * drift from the real terminal configuration. Today that list is empty (no
 * brand has been conclusively verified for the production terminal), so this
 * renders the generic Hebrew notice — never a guessed brand name or logo.
 */
export function CardBrandNotice() {
  if (CONFIRMED_CARD_BRANDS.length > 0) {
    return (
      <div
        role="note"
        className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-stone-500"
      >
        <span>כרטיסים נתמכים:</span>
        {CONFIRMED_CARD_BRANDS.map((brand) => (
          <span
            key={brand.id}
            aria-label={brand.label}
            className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-medium"
          >
            {brand.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      role="note"
      className="mt-3 flex items-start gap-2 rounded-lg bg-stone-50 border border-stone-100 p-2.5 text-xs text-stone-500 leading-relaxed"
    >
      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-stone-400" aria-hidden="true" />
      <span>{GENERIC_CARD_NOTICE}</span>
    </div>
  );
}
