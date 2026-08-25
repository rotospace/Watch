// Default reference data for the outreach app.
// Everything here is just a starting point — all of it is editable/extendable from the UI.

const DEFAULT_MARKETS = [
  { id: "miami", region: "South Florida", city: "Miami" },
  { id: "fort-lauderdale", region: "South Florida", city: "Fort Lauderdale" },
  { id: "west-palm-beach", region: "South Florida", city: "West Palm Beach" },
  { id: "boca-raton", region: "South Florida", city: "Boca Raton" },
  { id: "hollywood-fl", region: "South Florida", city: "Hollywood" },
  { id: "pompano-beach", region: "South Florida", city: "Pompano Beach" },
  { id: "delray-beach", region: "South Florida", city: "Delray Beach" },
  { id: "coral-gables", region: "South Florida", city: "Coral Gables" },
  { id: "aventura", region: "South Florida", city: "Aventura" },
  { id: "doral", region: "South Florida", city: "Doral" },
];

// category -> label used for grouping in the UI
const INDUSTRY_CATEGORIES = [
  { id: "home-services", label: "Home Services" },
  { id: "professional-services", label: "Professional Services" },
  { id: "health-wellness", label: "Health & Wellness" },
  { id: "food-retail", label: "Food & Retail" },
  { id: "custom", label: "Custom" },
];

// painHook: the one thing referenced in the opening line of the cold email to make it feel
// specific to that trade rather than generic spam.
const DEFAULT_INDUSTRIES = [
  { id: "roofing", category: "home-services", label: "Roofing Contractors", painHook: "storm-season lead spikes and slow follow-up on estimates" },
  { id: "hvac", category: "home-services", label: "HVAC Companies", painHook: "seasonal demand swings and missed after-hours calls" },
  { id: "plumbing", category: "home-services", label: "Plumbers", painHook: "emergency calls going to voicemail after hours" },
  { id: "landscaping", category: "home-services", label: "Landscaping & Lawn Care", painHook: "seasonal contract renewals with no online booking" },
  { id: "pest-control", category: "home-services", label: "Pest Control Companies", painHook: "recurring service renewals and thin online review counts" },
  { id: "cleaning", category: "home-services", label: "Cleaning Services", painHook: "lead flow that depends entirely on referrals" },

  { id: "law-firms", category: "professional-services", label: "Law Firms", painHook: "slow intake response times losing new consultations" },
  { id: "accounting", category: "professional-services", label: "Accounting & CPA Firms", painHook: "tax-season overload and a referral pipeline that dries up the rest of the year" },
  { id: "real-estate", category: "professional-services", label: "Real Estate Agencies", painHook: "agents still relying mainly on open houses and word of mouth" },
  { id: "insurance", category: "professional-services", label: "Insurance Agencies", painHook: "renewal season crunch and low local search visibility" },

  { id: "dental", category: "health-wellness", label: "Dental Practices", painHook: "new-patient acquisition outside the insurance-network referral list" },
  { id: "chiropractic", category: "health-wellness", label: "Chiropractors", painHook: "new-patient flow that swings wildly month to month" },
  { id: "med-spa", category: "health-wellness", label: "Med Spas", painHook: "high no-show rates and slow follow-up on inquiries" },
  { id: "gyms", category: "health-wellness", label: "Gyms & Fitness Studios", painHook: "membership churn and slow follow-up on trial leads" },

  { id: "restaurants", category: "food-retail", label: "Restaurants", painHook: "slow weeknights and no system for repeat visits" },
  { id: "auto-repair", category: "food-retail", label: "Auto Repair Shops", painHook: "customers price-shopping with no loyalty or reminder program" },
  { id: "salons", category: "food-retail", label: "Salons & Barbershops", painHook: "no-shows and gaps in the weekly book" },
  { id: "boutique-retail", category: "food-retail", label: "Boutique Retail Shops", painHook: "foot traffic that depends entirely on location" },
];

// The 3-step framework every industry's default script is generated from.
// Merge fields available everywhere: {{business_name}} {{owner_first_name}} {{website}} {{city}} {{region}}
// {{industry_label}} {{pain_hook}} {{your_name}} {{your_company}} {{your_offer}} {{proof_point}}
// {{booking_link}} {{your_phone}} {{signature}} {{signal}} {{signal_line}}
// signal is a free-text, per-prospect observation (e.g. "no standalone website, Facebook only").
// signal_line is the pre-built sentence that drops it into the opener — empty string when a
// prospect has no signal set, so scripts using it read fine either way.
// (unrecognized {{fields}} are left as-is so custom edits never silently break)
const SCRIPT_FRAMEWORK = [
  {
    step: 1,
    name: "Initial outreach (Day 0)",
    subject: "question about {{business_name}}",
    body:
`Hi {{owner_first_name}},

Most {{industry_label}} in {{city}} I talk to are dealing with {{pain_hook}}. {{signal_line}}If that's true for {{business_name}} too, I've got a couple of ideas around {{your_offer}} that might help — no obligation either way.

Worth a quick look?

{{signature}}`,
  },
  {
    step: 2,
    name: "Follow-up (Day 3)",
    subject: "one more idea for {{business_name}}",
    body:
`Hi {{owner_first_name}},

{{proof_point}}

Happy to walk you through how that could work for {{business_name}} — just reply here, or grab a time that works: {{booking_link}}.

{{signature}}`,
  },
  {
    step: 3,
    name: "Breakup / last touch (Day 10)",
    subject: "closing the loop",
    body:
`Hi {{owner_first_name}},

I don't want to keep cluttering your inbox, so I'll leave this here for now. If tackling {{pain_hook}} becomes a priority for {{business_name}} down the road, just reply and I'll pick it back up.

Either way, wishing you a strong season.

{{signature}}`,
  },
];

if (typeof module !== "undefined") {
  module.exports = { DEFAULT_MARKETS, INDUSTRY_CATEGORIES, DEFAULT_INDUSTRIES, SCRIPT_FRAMEWORK };
}
