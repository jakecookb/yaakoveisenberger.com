/** The public address of the site, for links in emails. SITE_URL overrides it (e.g. for local testing). */
export const siteUrl = () => (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://yaakoveisenberger.com').replace(/\/$/, '');
