import { Mail, MessageCircle, Phone } from 'lucide-react';

import { phoneHref, siteConfig, whatsappHref, formatPhone } from '@/lib/site-config';

/**
 * The programme's published contact channels.
 *
 * Every value comes from configuration and is rendered only when it is set, so
 * the site never shows a placeholder phone number or a guessed social profile.
 * Two layouts exist because the footer and the contact section have different
 * amounts of room.
 */
export function ContactChannels({
  variant = 'stacked',
  className,
}: {
  variant?: 'stacked' | 'inline';
  className?: string;
}) {
  const { contact } = siteConfig;

  const rows = [
    contact.emailHref
      ? {
          key: 'email',
          icon: Mail,
          label: 'Email',
          value: contact.emailHref,
          href: `mailto:${contact.emailHref}`,
          copyable: false,
        }
      : null,
    ...contact.phones.map((phone, index) => ({
      key: `phone-${phone}`,
      icon: Phone,
      label: index === 0 ? 'Phone' : 'Phone (alternate)',
      value: formatPhone(phone),
      href: `tel:${phoneHref(phone)}`,
      copyable: false,
    })),
    contact.whatsapp
      ? {
          key: 'whatsapp',
          icon: MessageCircle,
          label: 'WhatsApp',
          value: 'Message the office',
          href: whatsappHref(contact.whatsapp),
          copyable: false,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return null;

  if (variant === 'inline') {
    return (
      <ul className={className}>
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.key}>
              <a
                href={row.href}
                {...(row.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-navy-900 hover:underline"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                <span className="sr-only">{row.label}: </span>
                {row.value}
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className={className}>
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <li key={row.key} className="flex items-start gap-2.5">
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <span className="min-w-0">
              <span className="sr-only">{row.label}: </span>
              <a
                href={row.href}
                {...(row.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="break-words hover:text-navy-900 hover:underline"
              >
                {row.value}
              </a>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Social presence.
 *
 * The programme uses one handle across its platforms. Without a real profile
 * URL we show the handle as text rather than linking to a guessed or
 * non-existent account; supplying NEXT_PUBLIC_SOCIAL_LINKS turns it into links.
 */
export function SocialChannels({ className }: { className?: string }) {
  const { social } = siteConfig;

  if (!social.handle && social.links.length === 0) return null;

  if (social.links.length > 0) {
    return (
      <ul className={className}>
        {social.links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-navy-900 hover:underline"
            >
              {link.label}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className={className}>
      <span className="font-semibold text-navy-900">{social.handle}</span> on every social platform.
    </p>
  );
}
