import { createFileRoute } from '@tanstack/react-router'
import { getMeetingDetail } from '#/features/meetings/meetings.data'
import type { MeetingDetailLoaderData } from '#/features/meetings/meetings.data'
import MeetingDetail from '#/features/meetings/MeetingDetailPage'
import { requireAuth } from '#/lib/authHelpers'

export const Route = createFileRoute('/meetings/$meetingId')({
  component: function MeetingDetailWrapper() {
    const { meeting, segments, insights } = Route.useLoaderData()
    return <MeetingDetail meeting={meeting} segments={segments} insights={insights} />
  },
  loader: async ({ params }): Promise<MeetingDetailLoaderData> => {
    await requireAuth()
    return getMeetingDetail(params.meetingId)
  },
})
