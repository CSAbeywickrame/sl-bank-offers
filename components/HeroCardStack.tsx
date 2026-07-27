const base: React.CSSProperties = {
  position: "absolute", width: 250, height: 152, borderRadius: 16,
  boxShadow: "0 24px 48px rgba(0,0,10,.45)", color: "#fff", boxSizing: "border-box",
  padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between",
};

// Renders a decorative, desktop-only stack of three tilted credit cards beside the hero heading
export function HeroCardStack() {
  return (
    <div aria-hidden="true" className="sl-hero-cardstack">
      <div
        className="sl-cc"
        style={{
          ...base,
          left: 60,
          top: 70,
          zIndex: 1,
          background: "linear-gradient(135deg, #27447c, #101d3a 75%)",
          animation: "sl-cc-float 6.5s ease-in-out infinite -4s",
          ["--r" as string]: "13deg",
        } as React.CSSProperties}
      >
        <div style={{ fontSize: 10, letterSpacing: ".14em", opacity: .7 }}>BANK · GOLD</div>
        <div style={{ width: 30, height: 22, borderRadius: 5, background: "linear-gradient(135deg, #e8d28a, #b99530)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, letterSpacing: 1.2, fontWeight: 700 }}>5299 •• 8845 2210</span>
        </div>
      </div>

      <div
        className="sl-cc"
        style={{
          ...base,
          left: 130,
          top: 20,
          zIndex: 2,
          background: "linear-gradient(135deg, #cfa64c, #8a6a1e 75%)",
          animation: "sl-cc-float 6.5s ease-in-out infinite -2s",
          ["--r" as string]: "4deg",
        } as React.CSSProperties}
      >
        <div style={{ fontSize: 10, letterSpacing: ".14em", opacity: .7 }}>PREMIUM</div>
        <div style={{ width: 30, height: 22, borderRadius: 5, background: "linear-gradient(135deg, #e8d28a, #b99530)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, letterSpacing: 1.2, fontWeight: 700 }}>5412 •• 3412 3456</span>
        </div>
      </div>

      <div
        className="sl-cc"
        style={{
          ...base,
          left: 20,
          top: -30,
          zIndex: 3,
          background: "linear-gradient(135deg, #0f8f5f, #063d28 75%)",
          animation: "sl-cc-float 6.5s ease-in-out infinite",
          ["--r" as string]: "-7deg",
        } as React.CSSProperties}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: 10, letterSpacing: ".14em", opacity: .8 }}>SL CARD OFFERS</div>
        </div>
        <div style={{ width: 32, height: 24, borderRadius: 5, background: "linear-gradient(135deg, #e8d28a, #b99530)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, letterSpacing: 1.2, fontWeight: 700 }}>1234 5678 •••• 3456</span>
          <span style={{ fontWeight: 800, fontStyle: "italic", fontSize: 15 }}>VISA</span>
        </div>
      </div>
    </div>
  );
}
