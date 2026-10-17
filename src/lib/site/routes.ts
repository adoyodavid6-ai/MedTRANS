/**
 * Registry of every public page in masterplan §21.
 * `status: "live"` pages are fully functional in the current phase.
 * `status: "planned"` pages render an explicit "not yet activated" state naming the phase that delivers them.
 * The nav, sitemap and tests all read from here, so a link can never point at nothing.
 */
export type RouteStatus = "live" | "planned";

export type PublicRoute = {
  href: string;
  title: string;
  description: string;
  status: RouteStatus;
  /** Build phase that activates this page (§23). */
  phase: 1 | 2 | 3 | 4 | 5;
  module?: "pharmacy" | "doctorcare" | "smartcare" | "safety" | "support" | "company" | "legal" | "partners";
  /** Excluded from the sitemap (e.g. personal, transactional pages). */
  noindex?: boolean;
};

export const PUBLIC_ROUTES = [
  { href: "/", title: "Home", description: "Order medicines, request home care, or get urgent help.", status: "live", phase: 1 },
  { href: "/emergency", title: "Emergency Help", description: "What to do right now if someone's life may be at risk.", status: "live", phase: 1, module: "safety" },
  { href: "/how-it-works", title: "How it works", description: "How MedTRANS pharmacy orders, home visits and emergency guidance work.", status: "live", phase: 1, module: "company" },
  { href: "/about", title: "About MedTRANS", description: "Why MedTRANS exists and how we work.", status: "live", phase: 1, module: "company" },
  { href: "/coverage", title: "Check coverage", description: "See whether MedTRANS services are active where you are.", status: "live", phase: 1, module: "smartcare" },
  { href: "/help", title: "Help Centre", description: "Answers to common questions about MedTRANS.", status: "live", phase: 1, module: "support" },
  { href: "/contact", title: "Contact us", description: "How to reach the MedTRANS team.", status: "live", phase: 1, module: "support" },
  { href: "/legal/privacy", title: "Privacy notice", description: "How MedTRANS handles personal and health information.", status: "live", phase: 1, module: "legal" },
  { href: "/legal/terms", title: "Terms of service", description: "The terms for using MedTRANS.", status: "live", phase: 1, module: "legal" },
  { href: "/legal/cancellation-and-refunds", title: "Cancellation and refunds", description: "How cancellations and refunds work.", status: "live", phase: 1, module: "legal" },
  { href: "/legal/healthcare-disclaimer", title: "Healthcare disclaimer", description: "What MedTRANS is, and is not.", status: "live", phase: 1, module: "legal" },

  { href: "/pharmacy", title: "MedTRANS Pharmacy", description: "Medicines from verified, licensed pharmacies, delivered.", status: "live", phase: 2, module: "pharmacy" },
  { href: "/pharmacy/medicines", title: "Find a medicine", description: "Search medicines from verified pharmacies.", status: "live", phase: 2, module: "pharmacy" },
  { href: "/pharmacies", title: "Find a pharmacy", description: "Verified, licensed pharmacies near you.", status: "live", phase: 2, module: "pharmacy" },
  { href: "/cart", title: "Your cart", description: "Review your medicines before checkout.", status: "live", phase: 2, module: "pharmacy", noindex: true },
  { href: "/checkout", title: "Checkout", description: "Confirm your order and pay securely.", status: "live", phase: 2, module: "pharmacy", noindex: true },
  { href: "/orders/track", title: "Track an order", description: "Follow your order from pharmacy to door.", status: "live", phase: 2, module: "pharmacy", noindex: true },

  { href: "/doctorcare", title: "DoctorCare", description: "Qualified doctors and nurses for eligible home visits.", status: "live", phase: 3, module: "doctorcare" },
  { href: "/doctorcare/services", title: "Home-care services", description: "The home-care services MedTRANS offers.", status: "live", phase: 3, module: "doctorcare" },
  { href: "/find-a-doctor", title: "Find a doctor", description: "Verified doctors and nurses who visit at home.", status: "live", phase: 3, module: "doctorcare" },
  { href: "/doctorcare/book", title: "Request a home visit", description: "Book a qualified professional to visit you.", status: "live", phase: 3, module: "doctorcare", noindex: true },
  { href: "/bookings/status", title: "Booking status", description: "Follow your home-visit request.", status: "live", phase: 3, module: "doctorcare", noindex: true },
  { href: "/smartcare/map", title: "SmartCare map", description: "Suitable, available care near you, on a map and as a list.", status: "live", phase: 3, module: "smartcare" },

  { href: "/resources", title: "Health resources", description: "Professionally reviewed health information.", status: "live", phase: 5, module: "company" },
  { href: "/join/provider", title: "Join as a doctor or nurse", description: "Register to provide home visits through MedTRANS.", status: "live", phase: 3, module: "partners" },
  { href: "/join/courier", title: "Deliver with MedTRANS", description: "Apply to deliver medicines as a MedTRANS delivery partner.", status: "live", phase: 2, module: "partners" },
  { href: "/join/pharmacy", title: "Register your pharmacy", description: "List your licensed pharmacy on MedTRANS.", status: "live", phase: 2, module: "partners" },
  { href: "/partnerships", title: "Partnerships", description: "Work with MedTRANS as an organisation or institution.", status: "live", phase: 5, module: "partners" },
] as const satisfies readonly PublicRoute[];

export type PublicHref = (typeof PUBLIC_ROUTES)[number]["href"];

export function routeFor(href: PublicHref): PublicRoute {
  const r = PUBLIC_ROUTES.find((x) => x.href === href);
  if (!r) throw new Error(`Unknown route ${href}`);
  return r;
}

/** Header navigation, in masterplan §6B order. */
export const MAIN_NAV: { href: PublicHref; label: string }[] = [
  { href: "/pharmacy", label: "Pharmacy" },
  { href: "/doctorcare", label: "DoctorCare" },
  { href: "/find-a-doctor", label: "Find a Doctor" },
  { href: "/pharmacies", label: "Find a Pharmacy" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/emergency", label: "Safety & Emergency" },
  { href: "/help", label: "Help Centre" },
];

/** Header menu bar: grouped dropdowns (desktop) and grouped sections (mobile menu). */
export const NAV_GROUPS: { label: string; links: { href: PublicHref; label: string }[] }[] = [
  {
    label: "Pharmacy",
    links: [
      { href: "/pharmacy", label: "MedTRANS Pharmacy" },
      { href: "/pharmacy/medicines", label: "Find a medicine" },
      { href: "/pharmacies", label: "Find a pharmacy" },
      { href: "/orders/track", label: "Track an order" },
      { href: "/cart", label: "Your cart" },
    ],
  },
  {
    label: "DoctorCare",
    links: [
      { href: "/doctorcare", label: "DoctorCare" },
      { href: "/doctorcare/services", label: "Home-care services" },
      { href: "/find-a-doctor", label: "Find a doctor" },
      { href: "/doctorcare/book", label: "Request a home visit" },
      { href: "/smartcare/map", label: "SmartCare map" },
    ],
  },
  {
    label: "Safety",
    links: [
      { href: "/emergency", label: "Emergency Help" },
      { href: "/coverage", label: "Check coverage" },
    ],
  },
  {
    label: "Resources",
    links: [
      { href: "/resources", label: "Health resources" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/help", label: "Help Centre" },
    ],
  },
  {
    label: "Partners",
    links: [
      { href: "/join/provider", label: "Join as a doctor or nurse" },
      { href: "/join/pharmacy", label: "Register your pharmacy" },
      { href: "/join/courier", label: "Deliver with MedTRANS" },
      { href: "/partnerships", label: "Partnerships" },
    ],
  },
  {
    label: "About",
    links: [
      { href: "/about", label: "About MedTRANS" },
      { href: "/contact", label: "Contact us" },
    ],
  },
];

export const FOOTER_NAV: { heading: string; links: { href: PublicHref; label: string }[] }[] = [
  {
    heading: "Care",
    links: [
      { href: "/pharmacy", label: "Pharmacy" },
      { href: "/doctorcare", label: "DoctorCare" },
      { href: "/find-a-doctor", label: "Find a doctor" },
      { href: "/pharmacies", label: "Find a pharmacy" },
      { href: "/coverage", label: "Check coverage" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/resources", label: "Health resources" },
      { href: "/partnerships", label: "Partnerships" },
      { href: "/join/provider", label: "Join as a provider" },
      { href: "/join/pharmacy", label: "Register a pharmacy" },
      { href: "/join/courier", label: "Deliver with MedTRANS" },
    ],
  },
  {
    heading: "Help",
    links: [
      { href: "/help", label: "Help Centre" },
      { href: "/contact", label: "Contact" },
      { href: "/emergency", label: "Emergency Help" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/cancellation-and-refunds", label: "Cancellation & refunds" },
      { href: "/legal/healthcare-disclaimer", label: "Healthcare disclaimer" },
    ],
  },
];
