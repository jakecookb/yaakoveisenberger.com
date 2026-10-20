'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, Settings2 } from 'lucide-react';

/** The pill at the top right: "Log in" for everyone, "Admin" (straight to the editor) once the owner is signed in. */
export function LoginTab() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .then((d: { admin?: boolean }) => { if (alive) setAdmin(Boolean(d.admin)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return (
    <Link
      href={admin ? '/admin' : '/admin/login'}
      className={`ml-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 transition sm:ml-2 sm:px-3 ${admin ? 'border-[#c8a96a]/60 bg-[#c8a96a]/15 text-[#e6d3a3] hover:bg-[#c8a96a]/25' : 'border-white/15 text-neutral-300 hover:border-white/30 hover:bg-white/5 hover:text-white'}`}
    >
      {admin ? <Settings2 className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
      <span className="sr-only sm:not-sr-only">{admin ? 'Admin' : 'Log in'}</span>
    </Link>
  );
}
