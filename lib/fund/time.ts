// Shared (server + client) time helpers.

export function splitDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

export function campaignPhase(now: number, startsAt: string, endsAt: string) {
  if (now < Date.parse(startsAt)) return { phase: 'upcoming' as const, target: Date.parse(startsAt) };
  if (now < Date.parse(endsAt)) return { phase: 'live' as const, target: Date.parse(endsAt) };
  return { phase: 'ended' as const, target: Date.parse(endsAt) };
}
