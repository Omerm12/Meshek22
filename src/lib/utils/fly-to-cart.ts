/**
 * Animates a product image flying to the header cart button.
 *
 * Image sourcing strategy (prevents blank white circle):
 *   1. Use imgEl.currentSrc  — the actually-displayed URL resolved from srcset
 *   2. Fall back to imgEl.src if currentSrc is empty
 *   3. Only use the image if it is fully loaded (complete + naturalWidth > 0)
 *   4. Otherwise fall back to emoji from data-fly-icon
 *   5. Always paint a colored gradient background from data-fly-color so the
 *      circle is NEVER plain white, even while the image is loading
 */
export function flyToCart(sourceEl: HTMLElement): void {
  if (typeof window === "undefined") return;

  const cartBtn = document.getElementById("header-cart-btn");
  if (!cartBtn) return;

  const sourceRect = sourceEl.getBoundingClientRect();
  const targetRect = cartBtn.getBoundingClientRect();

  // Large enough to be clearly visible
  const size = Math.min(sourceRect.width, sourceRect.height, 88);
  const startX = sourceRect.left + (sourceRect.width - size) / 2;
  const startY = sourceRect.top  + (sourceRect.height - size) / 2;

  // ── Build the flying element ─────────────────────────────────────────────
  const fly = document.createElement("div");
  fly.style.cssText = [
    "position:fixed",
    `top:${startY}px`,
    `left:${startX}px`,
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:50%",
    "overflow:hidden",
    "pointer-events:none",
    "z-index:9999",
    "box-shadow:0 4px 24px rgba(0,0,0,0.24)",
    "will-change:transform,opacity",
  ].join(";");

  // Colored background from product data — guarantees non-white appearance
  const flyColor = sourceEl.dataset.flyColor;
  fly.style.background = flyColor
    ? `radial-gradient(ellipse at 50% 60%, ${flyColor} 0%, white 100%)`
    : "#e5e7eb"; // stone fallback

  // ── Image content ────────────────────────────────────────────────────────
  const imgEl = sourceEl.querySelector<HTMLImageElement>("img");

  // currentSrc is the browser-selected URL from srcset (the one actually shown)
  const imageSrc = imgEl?.currentSrc || imgEl?.src || "";
  const imageReady =
    Boolean(imageSrc) &&
    !imageSrc.startsWith("data:") &&  // skip Next.js blur placeholders
    (imgEl?.complete ?? false) &&
    (imgEl?.naturalWidth ?? 0) > 0;

  if (imageReady) {
    const clone = document.createElement("img");
    clone.src = imageSrc;
    clone.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;object-fit:contain";
    fly.appendChild(clone);
  } else {
    // Image not ready — show emoji icon so circle is never blank
    const icon = sourceEl.dataset.flyIcon;
    if (icon) {
      const span = document.createElement("span");
      span.textContent = icon;
      span.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2.25rem;line-height:1";
      fly.appendChild(span);
    }
  }

  document.body.appendChild(fly);

  // ── Animate ──────────────────────────────────────────────────────────────
  const targetCX = targetRect.left + targetRect.width  / 2;
  const targetCY = targetRect.top  + targetRect.height / 2;
  const flyCX    = startX + size / 2;
  const flyCY    = startY + size / 2;
  const dx = targetCX - flyCX;
  const dy = targetCY - flyCY;

  const cleanup = () => { if (fly.isConnected) fly.remove(); };

  if (typeof fly.animate === "function") {
    // Web Animations API: brief pop → fly to cart → shrink & fade
    const anim = fly.animate(
      [
        { transform: "scale(1)",                                       opacity: 1 },
        { transform: "scale(1.1)",                                     opacity: 1, offset: 0.08 },
        { transform: `translate(${dx}px,${dy}px) scale(0.28)`,        opacity: 0 },
      ],
      {
        duration: 820,
        easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        fill: "forwards",
      },
    );
    anim.onfinish = cleanup;
  } else {
    // CSS transition fallback for older browsers
    void fly.getBoundingClientRect();
    requestAnimationFrame(() => {
      fly.style.transition =
        "transform 0.82s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.45s ease-in 0.37s";
      fly.style.transform = `translate(${dx}px,${dy}px) scale(0.28)`;
      fly.style.opacity = "0";
    });
    fly.addEventListener("transitionend", cleanup, { once: true });
  }

  setTimeout(cleanup, 1000); // safety — always remove even if animation stalls
}
