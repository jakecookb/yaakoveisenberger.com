import { KeyRound } from 'lucide-react';
import { RentalCenter } from '@/components/rentals/rental-center';

export const metadata = { title: 'Rental Command Center', description: 'Your trip, AAA and discount codes in one place — compare Hertz, National and Avis on true all-in price.' };

export default function Page() {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mt-6 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-neutral-950" style={{ background: '#60a5fa' }}><KeyRound className="size-7" strokeWidth={2.2} /></span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Rental Command Center</h1>
            <p className="mt-1 text-neutral-400">Your trip, AAA and discount codes in one place — compare Hertz, National and Avis on true all-in price.</p>
          </div>
        </div>
        <div className="mt-8">
          <RentalCenter />
        </div>
      </div>
    </section>
  );
}
