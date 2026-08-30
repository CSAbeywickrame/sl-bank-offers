type AdSlotProps = {
  className?: string;
};

// Renders a placeholder leaderboard ad slot (728x90); swap the inner div for a real
// AdSense <ins class="adsbygoogle"> tag once an ad unit is wired up
export function AdSlot({ className }: AdSlotProps) {
  return (
    <div role="complementary" aria-label="Advertisement" className={`mx-auto max-w-7xl px-4 ${className ?? ""}`}>
      <div className="flex h-[90px] items-center justify-center rounded-lg border border-dashed border-(--border-default) bg-(--surface-card)">
        <span className="text-xs uppercase tracking-(--ls-wide) text-(--text-faint)">Advertisement · 728 × 90 leaderboard</span>
      </div>
    </div>
  );
}
