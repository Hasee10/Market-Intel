'use client';

// Ryvl's "Reach out to us" - the template has one, and until now the only
// way to contact anyone was the floating assistant widget.
//
// IMPORTANT, and the reason this looks the way it does: the template's own
// contact form POSTs to web3forms with the ORIGINAL AUTHOR'S API KEY
// hardcoded, so every submission would land in a stranger's inbox. That is
// never shipped here. This form opens the visitor's own mail client with the
// message pre-filled, addressed to NEXT_PUBLIC_CONTACT_EMAIL.
//
// mailto rather than a backend endpoint on purpose: there is no email
// provider wired up in this app (sendEmailStub in lib/notifications is a
// deliberate no-op) and no contact table, so a form that appeared to submit
// would silently drop messages. When a real destination exists, swap
// buildMailto for a fetch to it and the markup stays as-is.
//
// If the env var is unset the section does not render at all - better than
// showing a contact form that goes nowhere.

import { useState } from 'react';
import { MdOutlineEmail, MdOutlinePerson, MdArrowForward } from 'react-icons/md';

import { SectionTitle } from '@/components/landing/SectionTitle';
import { Reveal } from 'components/reactbits/Reveal';

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

const control =
  'w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:border-[#5044E5] focus:outline-none focus:ring-2 focus:ring-[#5044E5]/15 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

export function ContactSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  if (!CONTACT_EMAIL) return null;

  const buildMailto = () => {
    const subject = encodeURIComponent(`Ryvl enquiry from ${name || 'a visitor'}`);
    const body = encodeURIComponent(`${message}\n\n---\nFrom: ${name}\nReply to: ${email}`);
    return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <section
      id="contact"
      className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white"
    >
      <SectionTitle
        title="Reach out to us"
        desc="Questions about coverage, pricing, or getting your catalogue in? Send us a note."
      />

      <Reveal>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = buildMailto();
          }}
          className="w-full max-w-3xl"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">
                Your name
              </label>
              <div className="relative">
                <MdOutlinePerson className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="contact-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className={control}
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-email" className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">
                Email
              </label>
              <div className="relative">
                <MdOutlineEmail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={control}
                />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="contact-message" className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">
              Message
            </label>
            <textarea
              id="contact-message"
              required
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message"
              className={`${control} pl-3`}
            />
          </div>

          <button
            type="submit"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#5044E5] px-7 py-3 text-sm font-medium text-white transition-transform hover:scale-105"
          >
            Submit
            <MdArrowForward className="size-4" aria-hidden="true" />
          </button>

          <p className="mt-3 text-xs text-gray-400">
            Opens in your email app so you keep a copy of what you sent.
          </p>
        </form>
      </Reveal>
    </section>
  );
}

export default ContactSection;
