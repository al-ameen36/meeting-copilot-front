import { createFileRoute } from '@tanstack/react-router'

import LiveMeetingPage from '#/features/live-meeting/LiveMeetingPage'

export const Route = createFileRoute('/')({
  component: LiveMeetingPage,
})
