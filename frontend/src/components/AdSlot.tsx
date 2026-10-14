import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, ADS_ENABLED, AD_SLOTS, type AdPlacement } from "../lib/monetization";

type AdSlotProps = {
  placement: AdPlacement;
  format?: string;
  className?: string;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// Renders nothing until VITE_ADSENSE_CLIENT and the placement's ad unit id are
// configured, so the default build and the visual-regression snapshots are
// unaffected.
export function AdSlot({ placement, format = "auto", className }: AdSlotProps) {
  const pushed = useRef(false);
  const slot = AD_SLOTS[placement];

  useEffect(() => {
    if (!ADS_ENABLED || !slot || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // The AdSense script may not be ready yet; it retries on its own.
    }
  }, [slot]);

  if (!ADS_ENABLED || !slot) return null;

  return (
    <aside className={`ad-slot ad-slot--${placement}${className ? ` ${className}` : ""}`} aria-label="Advertisement">
      <span className="ad-slot-label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
