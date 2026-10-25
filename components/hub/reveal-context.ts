'use client';

import { createContext } from 'react';

/** True once a homepage section has been scrolled into focus; its cards pop in on that. Defaults to true outside the stacked homepage. */
export const SectionRevealed = createContext(true);
