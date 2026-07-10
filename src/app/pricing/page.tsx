import Link from "next/link";

const plans = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started and testing your first releases.",
    features: [
      "4 active campaigns",
      "100 contacts",
      "2 GB storage",
      "Feedback gate + downloads",
      "Artist feedback page",
      "PromoVault branding on emails",
    ],
    cta: "Get started free",
    href: "/signup",
    highlight: false,
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "For active labels regularly releasing and distributing promos.",
    features: [
      "20 active campaigns",
      "Unlimited contacts",
      "15 GB storage",
      "Everything in Free",
      "Export feedback to CSV",
      "Priority support",
    ],
    cta: "Start Pro",
    href: "/signup?plan=pro",
    highlight: true,
  },
  {
    tier: "label",
    name: "Label",
    price: "$49",
    period: "per month",
    description: "For established labels with high volume and team needs.",
    features: [
      "Unlimited campaigns",
      "Unlimited contacts",
      "50 GB storage",
      "Everything in Pro",
      "Up to 3 team members",
      "Advanced analytics export",
    ],
    cta: "Start Label",
    href: "/signup?plan=label",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <header className="border-b border-white/[0.05] px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="text-[11px] font-bold tracking-[0.2em] text-white/60 uppercase"
          >
            PromoVault
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-white/40 hover:text-white/70">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-white/90"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-20">
        {/* Header */}
        <div className="mb-14 text-center">
          <h1 className="text-4xl font-semibold text-white">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-white/40">
            No track-send fees. No surprises. Cancel anytime.
          </p>
        </div>

        {/* Plans */}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                plan.highlight
                  ? "border-white/20 bg-white/[0.04]"
                  : "border-white/[0.07] bg-white/[0.01]"
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-0.5 text-[10px] font-bold text-black uppercase tracking-widest">
                  Most popular
                </span>
              )}

              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
                  {plan.name}
                </p>
                <div className="mt-2 flex items-end gap-1.5">
                  <span className="text-3xl font-semibold text-white">{plan.price}</span>
                  <span className="mb-0.5 text-sm text-white/30">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-white/40">{plan.description}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="mt-0.5 shrink-0 text-emerald-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`w-full rounded-lg py-2.5 text-center text-sm font-semibold transition ${
                  plan.highlight
                    ? "bg-white text-black hover:bg-white/90"
                    : "border border-white/[0.1] bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQs */}
        <div className="mt-20 space-y-6 border-t border-white/[0.05] pt-14">
          <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-white/25">
            Common questions
          </h2>
          <div className="mx-auto max-w-2xl space-y-5">
            {[
              {
                q: "What counts as an active campaign?",
                a: "Any campaign in draft, scheduled, or active status. Expired campaigns don't count toward your limit — so you keep your history without it blocking new releases.",
              },
              {
                q: "What happens if I go over my storage limit?",
                a: "You can still access all existing campaigns and send emails. New uploads are blocked until you delete old files or upgrade your plan.",
              },
              {
                q: "Can I switch plans at any time?",
                a: "Yes. Upgrades take effect immediately. Downgrades apply at the end of your billing cycle.",
              },
              {
                q: "Is there a free trial for paid plans?",
                a: "The Free plan is permanent and gives you a full feel for the platform. Paid plans can be cancelled at any time with no penalty.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="space-y-1">
                <p className="text-sm font-medium text-white/80">{q}</p>
                <p className="text-sm text-white/35">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
