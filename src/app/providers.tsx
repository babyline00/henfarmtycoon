'use client'

import { MotionConfig } from 'framer-motion'

/**
 * Honours the OS "reduce motion" setting for every framer-motion
 * animation in the app. The game had nine infinite loops (weather
 * spin, incubator pulses, arcade button pulses) with no guard at all,
 * which is both an accessibility failure and needless paint work on
 * low-end phones.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
