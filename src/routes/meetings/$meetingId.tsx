import { createFileRoute, redirect } from '@tanstack/react-router'

import {
  getMeetingDetail,
  type MeetingDetailLoaderData,
} from '#/features/meetings/meetings.data'
import { MeetingDetailPage } from '#/features/meetings/MeetingDetailPage'
import { supabase } from '#/lib/supabase'

export const Route = createFileRoute('/meetings/$meetingId')({
  component: MeetingDetailPage,
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
