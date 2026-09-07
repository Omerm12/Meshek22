/**
 * Confirmed card brands enabled on the production CardCom terminal.
 *
 * A terminal's accepted card brands (Visa, Mastercard, Isracard, Amex, Diners,
 * debit, foreign-issued cards, …) are a property of the merchant's actual
 * acquirer/terminal configuration inside CardCom — NOT a general CardCom
 * platform capability, and not something this codebase, a card-number prefix,
 * or 3D Secure being enabled can determine. (3D Secure is a separate terminal
 * capability from brand authorization; enabling it does not enable any brand.)
 *
 * This file is the single source of truth the checkout UI reads from, so the
 * displayed text can never drift from what is actually configured here. As of
 * this writing NOTHING has been conclusively verified for terminal 189307 —
 * the business owner must confirm the enabled brands with CardCom (merchant
 * dashboard or CardCom support) before this list is populated. Rejections
 * such as "60000141 — מותג סגור, יש לפנות לחברת האשראי לפתיחת המותג" are
 * CardCom/acquirer-side terminal configuration issues, not bugs in this app,
 * and must not be "fixed" by guessing or advertising brands here.
 *
 * TO UPDATE ONCE CARDCOM CONFIRMS: replace the empty CONFIRMED_CARD_BRANDS
 * array below with the confirmed entries. Nothing else needs to change —
 * CardBrandNotice (src/components/checkout/CardBrandNotice.tsx) automatically
 * switches from the generic notice to the specific brand list.
 */

/** The production CardCom terminal this configuration describes. */
export const CARDCOM_TERMINAL_NUMBER = "189307";

export interface CardBrand {
  /** Stable identifier, e.g. "visa". */
  id: string;
  /** Hebrew display label, also used as the accessible label for its badge. */
  label: string;
}

/**
 * Empty until conclusively verified with CardCom for CARDCOM_TERMINAL_NUMBER.
 * Do not add a brand here from a card-number prefix, from general CardCom
 * capabilities, or from 3D Secure being enabled — only from a confirmed
 * terminal configuration.
 */
export const CONFIRMED_CARD_BRANDS: CardBrand[] = [];

/**
 * Shown on checkout, verbatim, whenever CONFIRMED_CARD_BRANDS is empty. Do
 * not translate, shorten, rephrase or otherwise modify this text — it was
 * specified exactly by the business owner.
 */
export const GENERIC_CARD_NOTICE =
  "ניתן לשלם בכרטיסי האשראי הנתמכים במסוף העסק. אם הכרטיס אינו מתקבל בדף הסליקה, יש לנסות כרטיס אחר.";
