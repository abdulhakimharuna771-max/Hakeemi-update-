/**
 * Programme identity and public contact channels.
 *
 * Owner-configurable: set these in .env.local. Anything left unset is simply not
 * rendered — the landing page never invents a phone number, address, email
 * address or social account that was not supplied.
 */

function env(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Reject obvious placeholder values so a template default never goes live. */
function realValue(value: string | null): string | null {
  if (!value) return null;
  if (/example\.(com|org|net)/i.test(value)) return null;
  if (/\byour[- ]?(email|phone|address|name)\b/i.test(value)) return null;
  return value;
}

/** Split a comma-separated env list into trimmed, non-empty entries. */
function envList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * National phone formatting for display: 08029088338 → 0802 908 8338, and
 * +234… / 234… kept as-is. Never used for dialling — `tel:` gets the digits.
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  if (/^0\d{10}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return value;
}

/** Digits only, plus a leading + when the number carries one. */
export function phoneHref(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

/**
 * A WhatsApp link needs an international number. Nigerian numbers written
 * locally (0802…) are converted to 234802…, which is what wa.me requires.
 */
export function whatsappHref(value: string): string {
  const digits = value.replace(/\D/g, '');
  const international = digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

const email = realValue(env(process.env.NEXT_PUBLIC_CONTACT_EMAIL));
const phoneList = envList(process.env.NEXT_PUBLIC_CONTACT_PHONES ?? process.env.NEXT_PUBLIC_CONTACT_PHONE)
  .map((entry) => entry.trim())
  .filter(Boolean);
const whatsapp = realValue(env(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP)) ?? phoneList[0] ?? null;

const emailHref = email ? email : null;

/**
 * Social accounts.
 *
 * A single handle is enough when the programme uses the same one everywhere:
 * it is displayed as text (never as a guessed profile URL). Setting
 * NEXT_PUBLIC_SOCIAL_LINKS to `Name=URL` pairs publishes real links instead.
 */
const socialHandle = realValue(env(process.env.NEXT_PUBLIC_SOCIAL_HANDLE));
const socialLinks = envList(process.env.NEXT_PUBLIC_SOCIAL_LINKS)
  .map((entry) => {
    const separator = entry.indexOf('=');
    if (separator < 1) return null;
    const label = entry.slice(0, separator).trim();
    const href = entry.slice(separator + 1).trim();
    if (!label || !/^https?:\/\//i.test(href)) return null;
    return { label, href };
  })
  .filter((entry): entry is { label: string; href: string } => entry !== null);

export const siteConfig = {
  organisation: 'GIZMO DAN KAITA OFFICE PLUS',
  programName: 'Final Year Project & Innovation Development Program',
  programNameShort: 'Final Year Project & Innovation Program',
  headline: 'Turn Ideas Into Opportunities.',
  supportingMessage:
    'A digital platform connecting education, technology, innovation, entrepreneurship and community development.',

  /** Public contact channels. Unset values are hidden rather than faked. */
  contact: {
    email,
    emailHref,
    /** Every published number, in the order given. */
    phones: phoneList,
    whatsapp,
    addressLines: envList(process.env.NEXT_PUBLIC_CONTACT_ADDRESS),
    officeHours: realValue(env(process.env.NEXT_PUBLIC_CONTACT_HOURS)),
  },

  social: {
    handle: socialHandle,
    links: socialLinks,
  },

  /** The nine areas the programme connects, as stated in the programme brief. */
  focusAreas: [
    'Education',
    'Technology',
    'Innovation',
    'Industry',
    'Entrepreneurship',
    'Community Development',
    'Youth Development',
    'Digital Skills',
    'Business Opportunities',
  ],
} as const;

export const hasAnyContactChannel = (): boolean => {
  const c = siteConfig.contact;
  return Boolean(c.email || c.phones.length > 0 || c.addressLines.length > 0);
};

export const hasAnySocialChannel = (): boolean =>
  Boolean(siteConfig.social.handle || siteConfig.social.links.length > 0);

/** Absolute site origin, used for auth redirect URLs. */
export function getSiteOrigin(fallbackOrigin?: string): string {
  const configured = env(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured.replace(/\/+$/, '');
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, '');
  return 'http://localhost:3000';
}
