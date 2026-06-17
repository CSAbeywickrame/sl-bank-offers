/* global React, ReactDOM, SLCO_DATA */
const NS = window.SLCardOffersDesignSystem_d33c99;
const { Header, Hero, Footer, OfferCard, BankCard, Badge, Button, Select, SearchBar, IconButton, EmptyState } = NS;
const { useState, useMemo } = React;
const DATA = window.SLCO_DATA || { banks: [], categories: [], offers: [] };
const LOGO = "../../assets/sl-card-offers-logo.png";

/* ---- small inline icons (lucide-style) ---- */
const Heart = ({ filled }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
);
const Back = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);

/* ---- Filter bar (mirrors production FilterPanel) ---- */
function FilterBar({ filters, setFilters }) {
  const active = [filters.bank, filters.category, filters.search].filter(Boolean).length;
  return (
    <div style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-card)", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "12px var(--container-pad)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)" }}>Filter offers</span>
            {active > 0 && <Badge tone="bank">{active}</Badge>}
          </div>
          {active > 0 && (
            <button onClick={() => setFilters({ bank: "", category: "", search: "" })}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-muted)", textDecoration: "underline", textUnderlineOffset: 2 }}>
              Clear all
            </button>
          )}
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 2fr" }}>
          <Select label="Bank" value={filters.bank} onChange={(e) => setFilters({ ...filters, bank: e.target.value })}>
            <option value="">All banks</option>
            {DATA.banks.map((b) => <option key={b.id} value={b.id}>{b.shortName}</option>)}
          </Select>
          <Select label="Category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All categories</option>
            {DATA.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "var(--ls-wide)", color: "var(--text-muted)" }}>Search</span>
            <SearchBar defaultValue={filters.search} onSearch={(q) => setFilters({ ...filters, search: q })} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Offer card with a save affordance for signed-in users ---- */
function SavableOffer({ offer, signedIn, saved, onToggleSave, onOpen, onRequireSignIn }) {
  return (
    <div style={{ position: "relative" }}>
      <OfferCard {...offer} category={DATA.categories.find((c) => c.id === offer.category)?.label || offer.category}
        onViewDetails={() => onOpen(offer)} sourceUrl={offer.sourceUrl} />
      <div style={{ position: "absolute", top: 14, right: 14 }}>
        <IconButton label={saved ? "Remove from saved" : "Save offer"} variant="ghost"
          onClick={() => (signedIn ? onToggleSave(offer.id) : onRequireSignIn())}
          style={{ background: "var(--surface-card)", color: saved ? "var(--red-600)" : "var(--text-faint)" }}>
          <Heart filled={saved} />
        </IconButton>
      </div>
    </div>
  );
}

/* ---- Offer detail screen ---- */
function OfferDetail({ offer, onBack }) {
  const catLabel = DATA.categories.find((c) => c.id === offer.category)?.label || offer.category;
  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "32px var(--container-pad)", display: "grid", gap: 32 }}>
      <div style={{ display: "grid", gap: 16 }}>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text-link)", padding: 0, width: "fit-content" }}>
          <Back /> Back to all offers
        </button>
        <div style={{ background: "var(--surface-inverse)", borderRadius: "var(--radius-xl)", padding: "32px 28px", color: "#fff" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span style={{ borderRadius: "var(--radius-pill)", background: "rgba(255,255,255,.1)", padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{offer.bankName}</span>
            <span style={{ borderRadius: "var(--radius-pill)", background: "rgba(212,175,95,.18)", padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "var(--gold-300)" }}>{catLabel}</span>
            {offer.expiringSoon && <span style={{ borderRadius: "var(--radius-pill)", background: "rgba(248,113,113,.15)", padding: "4px 12px", fontSize: 12, fontWeight: 600, color: "#fecaca" }}>Expiring soon</span>}
          </div>
          <h1 style={{ margin: "16px 0 0", fontSize: 30, fontWeight: 600, lineHeight: 1.2 }}>{offer.title}</h1>
          <p style={{ margin: "16px 0 0", maxWidth: 720, fontSize: 14, lineHeight: 1.7, color: "var(--text-on-inverse-muted)" }}>{offer.description}</p>
        </div>
      </div>

      <section style={{ display: "grid", gap: 24, gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
        <article style={{ background: "var(--surface-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: 24, boxShadow: "var(--shadow-sm)" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-strong)" }}>Offer details</h2>
          <dl style={{ marginTop: 20, display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr", fontSize: 14, color: "var(--text-body)" }}>
            {[["Bank", offer.bankName], ["Eligible card", offer.cardName], ["Category", catLabel], ["Merchant", offer.merchant], ["Location", offer.location], ["Valid until", offer.validUntil], ["Last checked", offer.lastChecked]].map(([k, v]) => (
              <div key={k}><dt style={{ fontWeight: 600, color: "var(--text-strong)" }}>{k}</dt><dd style={{ margin: "4px 0 0", color: k === "Valid until" && offer.expiringSoon ? "var(--red-600)" : "var(--text-body)" }}>{v}</dd></div>
            ))}
          </dl>
        </article>
        <aside style={{ display: "grid", gap: 16, background: "var(--surface-muted)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-strong)" }}>Official links</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>Confirm the latest eligibility, dates and exclusions at the official bank source before using the offer.</p>
          <Button variant="accent" size="lg" fullWidth onClick={() => window.open(offer.sourceUrl, "_blank")}>View at bank</Button>
          <Button variant="outline" size="lg" fullWidth onClick={() => window.open(offer.sourceUrl, "_blank")}>View terms</Button>
        </aside>
      </section>
    </main>
  );
}

/* ---- Banks directory ---- */
function BanksScreen({ onOpenBank }) {
  return (
    <main>
      <section style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-card)" }}>
        <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "32px var(--container-pad)" }}>
          <nav style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Home / <span style={{ fontWeight: 600, color: "var(--text-body)" }}>Banks</span></nav>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "var(--ls-tight)", color: "var(--text-strong)" }}>Sri Lankan Banks with Credit Card Offers</h1>
          <p style={{ margin: "8px 0 0", maxWidth: 560, fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>Browse active credit card promotions by bank. Select a bank to see all its current offers.</p>
        </div>
      </section>
      <section style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "32px var(--container-pad)" }}>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, 1fr)" }}>
          {DATA.banks.map((b) => <BankCard key={b.id} name={b.name} offerCount={b.offers} onClick={() => onOpenBank(b.id)} />)}
        </div>
      </section>
    </main>
  );
}

/* ---- Sign-in modal (the planned logged-in ecosystem) ---- */
function SignInModal({ onClose, onSignIn }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(2,6,23,.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: "var(--surface-card)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)", padding: 28 }}>
        <img src="../../assets/icon-card.png" alt="" style={{ width: 44, height: 44 }} />
        <h2 style={{ margin: "16px 0 0", fontSize: 20, fontWeight: 700, color: "var(--text-strong)" }}>Sign in to save offers</h2>
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>Create a free account to save offers, set expiry reminders and get deals tailored to your cards.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <Button variant="primary" size="lg" fullWidth onClick={onSignIn}>Continue with Google</Button>
          <Button variant="outline" size="lg" fullWidth onClick={onSignIn}>Continue with email</Button>
        </div>
        <p style={{ margin: "16px 0 0", fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>By continuing you agree to verify all offers directly with your bank.</p>
      </div>
    </div>
  );
}

/* ---- Sponsored / ad slot (planned monetisation) ---- */
function AdSlot() {
  return (
    <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "0 var(--container-pad)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: 90, border: "1px dashed var(--border-default)", borderRadius: "var(--radius-lg)", background: "var(--surface-card)", color: "var(--text-faint)", fontSize: 12, letterSpacing: "var(--ls-wide)", textTransform: "uppercase" }}>
        <span style={{ fontWeight: 600 }}>Advertisement</span>
        <span style={{ width: 1, height: 16, background: "var(--border-subtle)" }} />
        <span>728 × 90 leaderboard</span>
      </div>
    </div>
  );
}

/* ============================ App ============================ */
function App() {
  const [screen, setScreen] = useState("home");
  const [filters, setFilters] = useState({ bank: "", category: "", search: "" });
  const [active, setActive] = useState("offers");
  const [detail, setDetail] = useState(null);
  const [signedIn, setSignedIn] = useState(false);
  const [saved, setSaved] = useState({});
  const [showSignIn, setShowSignIn] = useState(false);

  const filtered = useMemo(() => {
    let list = screen === "saved" ? DATA.offers.filter((o) => saved[o.id]) : DATA.offers;
    if (screen === "home" || screen === "saved") {
      if (filters.bank) list = list.filter((o) => o.bankId === filters.bank);
      if (filters.category) list = list.filter((o) => o.category === filters.category);
      if (filters.search) {
        const q = filters.search.toLowerCase();
        list = list.filter((o) => (o.title + o.merchant + o.bankName + o.description).toLowerCase().includes(q));
      }
    }
    return list;
  }, [screen, filters, saved]);

  function nav(id) {
    setActive(id);
    setDetail(null);
    if (id === "offers") setScreen("home");
    else if (id === "banks") setScreen("banks");
    else if (id === "categories") setScreen("home");
    else if (id === "saved") setScreen("saved");
  }
  function openOffer(o) { setDetail(o); setScreen("detail"); window.scrollTo(0, 0); }
  function toggleSave(id) { setSaved((s) => ({ ...s, [id]: !s[id] })); }
  function doSignIn() { setSignedIn(true); setShowSignIn(false); }

  const savedCount = Object.values(saved).filter(Boolean).length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-page)" }}>
      <Header logoSrc={LOGO} active={active} signedIn={signedIn} userName="Nimal"
        onNavigate={nav} onSignIn={() => setShowSignIn(true)} />

      <div style={{ flex: 1 }}>
        {screen === "detail" && detail && <OfferDetail offer={detail} onBack={() => { setScreen("home"); setActive("offers"); }} />}

        {screen === "banks" && <BanksScreen onOpenBank={(id) => { setFilters({ bank: id, category: "", search: "" }); nav("offers"); }} />}

        {(screen === "home" || screen === "saved") && (
          <main>
            {screen === "home" && (
              <Hero
                title={`Compare ${"1,024"}+ Sri Lankan Credit Card Offers`}
                highlight="from 12+ Banks"
                subtitle="Compare active credit card offers across Sri Lankan banks and categories. Always verify details at the official bank source before using an offer."
                stats={[{ value: filtered.length, label: "matching offers" }, { value: 12, label: "banks tracked" }]}
              />
            )}
            {screen === "saved" && (
              <section style={{ background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "28px var(--container-pad)" }}>
                  <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--text-strong)" }}>Saved offers</h1>
                  <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-muted)" }}>{savedCount} offer{savedCount === 1 ? "" : "s"} saved to your account.</p>
                </div>
              </section>
            )}

            <FilterBar filters={filters} setFilters={setFilters} />

            <div style={{ padding: "20px 0 0" }}><AdSlot /></div>

            <section style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "24px var(--container-pad) 40px" }}>
              {filtered.length > 0 ? (
                <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(3, 1fr)", alignItems: "stretch" }}>
                  {filtered.map((o) => (
                    <SavableOffer key={o.id} offer={o} signedIn={signedIn} saved={!!saved[o.id]}
                      onToggleSave={toggleSave} onOpen={openOffer} onRequireSignIn={() => setShowSignIn(true)} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={screen === "saved" ? "No saved offers yet" : "No offers found"}
                  description={screen === "saved" ? "Tap the heart on any offer to save it to your account." : "No offers match your current filters. Try adjusting the bank, category, or search term."}
                  actionLabel={screen === "saved" ? "Browse offers" : "Clear filters"}
                  onAction={() => { setFilters({ bank: "", category: "", search: "" }); nav("offers"); }}
                />
              )}
            </section>
          </main>
        )}
      </div>

      {/* Signed-in users get a Saved tab in the footer-adjacent nav */}
      {signedIn && screen !== "detail" && (
        <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60 }}>
          <Button variant="primary" iconLeft={<Heart filled />} onClick={() => nav("saved")}>
            Saved {savedCount > 0 ? `(${savedCount})` : ""}
          </Button>
        </div>
      )}

      <Footer />
      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} onSignIn={doSignIn} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
