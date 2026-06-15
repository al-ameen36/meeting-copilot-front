import {
  getSegments,
  listMeetings,
  getMeeting,
} from '#/lib/localdb/transcriptStore'

export type Meeting = {
  id: string
  title?: string
  createdAt: number
}

export type Segment = {
  id: string
  text: string
  end?: number
  meetingId: string
  start: number
}

export type MeetingDetailLoaderData = {
  meeting: Meeting
  segments: Array<Segment>
}

export async function getMeetings() {
  return (await listMeetings()) as Array<Meeting>
}

export async function getMeetingDetail(
  meetingId: string,
): Promise<MeetingDetailLoaderData> {
  const meeting = await getMeeting(meetingId)
  if (!meeting) throw new Error('Meeting not found')

  const segments = await getSegments(meetingId)

  return {
    meeting: meeting as Meeting,
    segments: (segments ?? []) as Array<Segment>,
  }
}
