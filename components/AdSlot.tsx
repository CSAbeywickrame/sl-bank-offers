type AdSlotProps = {
  className?: string;
};

// Renders a placeholder leaderboard ad slot (728x90); swap the inner div for a real
// AdSense <ins class="adsbygoogle"> tag once an ad unit is wired up
export function AdSlot({ className }: AdSlotProps) {
  return (
    <div role="complementary" aria-label="Advertisement" className={`mx-auto max-w-7xl px-4 ${className ?? ""}`}>
      <div className="flex h-[90px] items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] bg-white">
        <span className="text-xs uppercase tracking-wide text-[var(--text-faint)]">Advertisement · 728 × 90 leaderboard</span>
      </div>
    </div>
  );
}
