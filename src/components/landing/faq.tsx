import { siteConfig } from '@/lib/site-config';

/**
 * Frequently asked questions.
 *
 * Native <details>/<summary> keeps this accessible and keyboard-operable with no
 * JavaScript at all. Answers describe only what this platform actually does —
 * no invented fees, deadlines, partner names or success stories.
 */
const FAQS = [
  {
    question: 'Who can register on this platform?',
    answer:
      'Registration is open to students, business owners, farmers, professionals and innovators. Each category collects the information that is relevant to it, so you are not asked to answer questions that do not apply to you.',
  },
  {
    question: 'Is there a fee to register?',
    answer:
      'No fee is charged for registering on this platform, and the programme has not published any application fee through it. If anyone asks you to pay to submit or to speed up your application, treat it as fraudulent and report it to the programme office.',
  },
  {
    question: 'What happens after I submit my application?',
    answer:
      'Your application receives a unique Application ID in the format GKO-YEAR-XXXXXX. Its status then moves through review stages — submitted, under review, and so on — visible at all times on your dashboard. You will receive a notification in your dashboard whenever the status changes.',
  },
  {
    question: 'Do I need to finish my application in one sitting?',
    answer:
      'No. Each step saves to your account, so you can close the page and continue later, on the same device or a different one. Your progress is stored against your account, not in the browser.',
  },
  {
    question: 'Which documents should I upload?',
    answer:
      'Upload only what supports your application and what you are comfortable sharing — for example a student ID, a project document, a business registration document or an identification document. Documents are optional at submission; a reviewer can request specific documents later if they are needed. All uploads are stored privately and are never publicly accessible.',
  },
  {
    question: 'How long does the review take?',
    answer:
      'Review timelines are decided by the programme office and are published once confirmed. Rather than guessing, check your dashboard: it always shows your current stage, and the date each stage was reached.',
  },
  {
    question: 'Why do I have to verify my email address?',
    answer:
      'Verification confirms that the address on your application belongs to you, and it is what allows you to reset your password and receive status notifications. Until you verify, your application stays saved but you cannot submit it.',
  },
  {
    question: 'Who can see the information I provide?',
    answer:
      `Your application, documents and notifications are visible only to you and to the authorised ${siteConfig.organisation} review team. Access is enforced in the database itself, not merely hidden in the interface.`,
  },
];

export function FaqSection() {
  return (
    <ul className="divide-y divide-slate-200 border-y border-slate-200">
      {FAQS.map((item, index) => (
        <li key={item.question}>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-left">
              <h3 className="text-base font-semibold text-navy-900">
                <span className="tabular mr-2 text-sm font-normal text-slate-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {item.question}
              </h3>
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition-transform group-open:rotate-45"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
              </span>
            </summary>
            <p className="max-w-3xl pb-6 pr-10 text-sm leading-relaxed text-slate-600">{item.answer}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}
