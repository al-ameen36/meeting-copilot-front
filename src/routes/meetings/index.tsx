import { createFileRoute } from '@tanstack/react-router'
import { getMeetings } from '#/features/meetings/meetings.data'
import MeetingsDashboard from '#/features/meetings/MeetingsDashboardPage'
import { requireAuth } from '#/lib/authHelpers'
export const Route = createFileRoute('/meetings/')({
  component: function MeetingsDashboardWrapper() {
    const { meetings } = Route.useLoaderData()
    return <MeetingsDashboard meetings={meetings} />
  },
  loader: async () => {
    await requireAuth()
    return { meetings: await getMeetings() }
  },
})
