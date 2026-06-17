// Site-wide footer with forest background and gold gradient top rule
export function Footer() {
  return (
    <footer className="mt-auto" style={{ background: "#08271c" }}>
      <div
        style={{
          height: "2px",
          background: "linear-gradient(90deg, #a87d1f, #e1c46e 50%, #a87d1f)",
        }}
      />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm font-semibold" style={{ color: "#e1c46e" }}>
            Sri Lankan Bank Card Offers
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            Data sourced from official bank websites · Verify all offers directly with your bank
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
