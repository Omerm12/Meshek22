/**
 * "Skip to main content" link (WCAG 2.4.1 / Israeli Standard 5568).
 * Visually hidden until it receives keyboard focus, then shown at the top.
 */
export function SkipLink({ target }: { target: string }) {
  return (
    <a
      href={`#${target}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-brand-800 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      דלגו לתוכן הראשי
    </a>
  );
}
