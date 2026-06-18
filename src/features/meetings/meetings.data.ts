import {
  getSegments,
  listMeetings,
  getMeeting,
} from '#/lib/localdb/transcriptStore'

import type { Meeting as StoredMeeting, Segment as StoredSegment } from '#/lib/localdb/transcriptStore'
import type { Meeting, Segment } from '#/types/transcripts'

export type MeetingDetailLoaderData = {
  meeting: Meeting
  segments: Array<Segment>
}

/** Convert local DB Meeting to shared Meeting shape */
function mapMeeting(m: StoredMeeting): Meeting {
  return {
    id: m.id,
    title: m.title ?? '',
    start_time: null,
    end_time: null,
    createdAt: new Date(m.createdAt).toISOString(),
  }
}

export async function getMeetings() {
  const stored = await listMeetings()
  return stored.map(mapMeeting)
}

export async function getMeetingDetail(
  meetingId: string,
): Promise<MeetingDetailLoaderData> {
  const stored = await getMeeting(meetingId)
  if (!stored) throw new Error('Meeting not found')

  const meeting = mapMeeting(stored)
  const segments = (await getSegments(meetingId)) as StoredSegment[]

  return {
    meeting,
    segments: segments as Array<Segment>,
  }
}

// Re-export Meeting type for convenience
export type { Meeting }
