/**
 * Placeholder art for the editorial layout. [[CONFIRM: brand photography]]: each slot is meant for a real
 * photograph (never stock images presented as MedTRANS patients, staff or partners).
 */

/** Full-bleed backdrop: warm dusk light over a Nairobi-like skyline silhouette. */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#3a3f33]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,#c9b48a_0%,#8a8661_30%,#4b5240_60%,#2c2f27_100%)]" />
      <svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[55%] w-full">
        <path fill="#2a2d24" opacity="0.55" d="M0 260h80v-60h40v-40h30v40h50v-90h60v120h40v-70h70v100h40v-150h50v150h60v-80h40v-40h50v60h60v-110h70v120h40v-60h60v90h50v-140h70v140h40v-70h60v60h60v-100h50v100h60v-50h80V400H0z" />
        <path fill="#22251d" d="M0 330c120-30 260-40 420-20s300 40 470 20 330-50 550-30V400H0z" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-black/45" />
    </div>
  );
}

/** A delivery parcel with two medicine bottles. */
export function ParcelArt({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 520 440" className={className}>
      <defs>
        <linearGradient id="box" x1="0" x2="1"><stop offset="0" stopColor="#2a2a28" /><stop offset="1" stopColor="#3b3b38" /></linearGradient>
        <linearGradient id="bottleA" x1="0" x2="1"><stop offset="0" stopColor="#4d6643" /><stop offset=".5" stopColor="#6f8c62" /><stop offset="1" stopColor="#4d6643" /></linearGradient>
        <linearGradient id="bottleB" x1="0" x2="1"><stop offset="0" stopColor="#8a5c37" /><stop offset=".5" stopColor="#b07a4e" /><stop offset="1" stopColor="#8a5c37" /></linearGradient>
      </defs>
      <ellipse cx="260" cy="420" rx="230" ry="16" fill="#000" opacity=".08" />
      <path d="M60 210l200-60 200 60v190l-200 30-200-30z" fill="url(#box)" />
      <path d="M60 210l200 40 200-40" fill="none" stroke="#4a4a46" strokeWidth="2" />
      <path d="M260 250v180" stroke="#4a4a46" strokeWidth="2" />
      <text x="160" y="345" fill="#fffdf9" fontSize="30" fontWeight="600" letterSpacing="-1" transform="skewY(4)">MedTRANS</text>
      <rect x="140" y="60" width="74" height="26" rx="5" fill="#2f2f2c" />
      <rect x="146" y="84" width="62" height="120" rx="12" fill="url(#bottleB)" />
      <rect x="156" y="120" width="42" height="40" rx="3" fill="#f3ead9" opacity=".9" />
      <rect x="262" y="96" width="60" height="22" rx="5" fill="#2f2f2c" />
      <rect x="266" y="116" width="52" height="96" rx="10" fill="url(#bottleA)" />
      <rect x="274" y="140" width="36" height="32" rx="3" fill="#f3ead9" opacity=".9" />
    </svg>
  );
}

/** Soft tonal panel used behind section titles. */
export function PanelBackdrop({ tone }: { tone: "sage" | "sand" | "dusk" }) {
  const bg = {
    sage: "bg-[radial-gradient(ellipse_at_80%_10%,#d9dfcc_0%,#a9b596_45%,#7c8a6a_100%)]",
    sand: "bg-[radial-gradient(ellipse_at_20%_0%,#f4ead6_0%,#d9c4a0_50%,#b39470_100%)]",
    dusk: "bg-[radial-gradient(ellipse_at_75%_30%,#8d8473_0%,#5b564b_50%,#34322c_100%)]",
  }[tone];
  return <div aria-hidden className={`absolute inset-0 ${bg}`} />;
}
