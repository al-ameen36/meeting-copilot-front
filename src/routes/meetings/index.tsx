import { createFileRoute, redirect } from '@tanstack/react-router'

import { getMeetings } from '#/features/meetings/meetings.data'
import { MeetingsDashboardPage } from '#/features/meetings/MeetingsDashboardPage'
import { supabase } from '#/lib/supabase'

export const Route = createFileRoute('/meetings/')({
  component: MeetingsDashboardPage,
  loader: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw redirect({ to: '/login' })
    }

    return { meetings: await getMeetings() }
  },
})
