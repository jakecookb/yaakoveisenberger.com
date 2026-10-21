import { Mail, Phone } from 'lucide-react';
import { site } from '@/lib/site/content';
import { ContactForm } from '@/components/site/contact-form';

export const metadata = { title: 'Contact & Booking' };

export default function ContactPage() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <h1 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#c8a96a]">Get in touch</h1>
        <p className="mx-auto mt-4 max-w-md text-neutral-400">Send a message below, or email or call anytime.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={`mailto:${site.email}`} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-neutral-950 transition hover:bg-neutral-200">
            <Mail className="size-4" /> {site.email}
          </a>
          <a href={site.phoneHref} className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-6 font-semibold text-white transition hover:bg-white/5">
            <Phone className="size-4" /> {site.phone}
          </a>
        </div>
        <div className="mt-12"><ContactForm /></div>
      </div>
    </section>
  );
}
