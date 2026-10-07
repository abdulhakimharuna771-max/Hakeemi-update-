/**
 * Programme identity and public contact channels.
 *
 * Owner-configurable: set these in .env.local. Anything left unset is simply
 * not rendered — the landing page never invents a phone number, address or
 * email address that was not supplied.
 */

function env(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const siteConfig = {
  organisation: 'GIZMO DAN KAITA OFFICE PLUS',
  programName: 'Final Year Project & Innovation Development Program',
  programNameShort: 'Final Year Project & Innovation Program',
  headline: 'Turn Ideas Into Opportunities.',
  supportingMessage:
    'A digital platform connecting education, technology, innovation, entrepreneurship and community development.',

  /** Public contact channels. Unset values are hidden rather than faked. */
  contact: {
    email: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
    phone: env(process.env.NEXT_PUBLIC_CONTACT_PHONE),
    whatsapp: env(process.env.NEXT_PUBLIC_CONTACT_WHATSAPP),
    addressLines: (env(process.env.NEXT_PUBLIC_CONTACT_ADDRESS) ?? '')
      .split('|')
      .map((line) => line.trim())
      .filter(Boolean),
    officeHours: env(process.env.NEXT_PUBLIC_CONTACT_HOURS),
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
  return Boolean(c.email || c.phone || c.whatsapp || c.addressLines.length > 0);
};

/** Absolute site origin, used for auth redirect URLs. */
export function getSiteOrigin(fallbackOrigin?: string): string {
  const configured = env(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured.replace(/\/+$/, '');
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, '');
  return 'http://localhost:3000';
}
