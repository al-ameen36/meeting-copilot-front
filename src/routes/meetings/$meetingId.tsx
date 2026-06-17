import { createFileRoute, redirect } from '@tanstack/react-router'

import { getMeetingDetail } from '#/features/meetings/meetings.data'
import type { MeetingDetailLoaderData } from '#/features/meetings/meetings.data'
import MeetingDetail from '#/features/meetings/MeetingDetailPage'
import { supabase } from '#/lib/supabase'

export const Route = createFileRoute('/meetings/$meetingId')({
  component: function MeetingDetailWrapper() {
    const { meeting, segments } = Route.useLoaderData()
    return <MeetingDetail meeting={meeting} segments={segments} />
  },
  loader: async ({ params }): Promise<MeetingDetailLoaderData> => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw redirect({ to: '/login' })
    }

    return getMeetingDetail(params.meetingId)
  },
})
