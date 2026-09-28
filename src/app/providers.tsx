'use client'

import{ MotionConfig} from'framer-motion'

/**
 * Honours theOS "reducemotion" setting for every framer-motion* animation in the app.The game had nine infinite loops(weather* spin, incubatorpulses, arcade buttonpulses) with no guard atall,
 * which is both an accessibility failure and needless paint work on* low-end phones.*/ export function Providers({ children}:{ children:React.ReactNode}) {
  return<Moti onConfigreducedMotion="user">{children}</MotionConfig>
}
