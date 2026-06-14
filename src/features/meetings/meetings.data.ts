import { supabase } from '#/lib/supabase'

export type Meeting = {
  id: string
  title: string
  status?: string
  start_time: string | null
  end_time: string | null
  created_at: string
}

export type Insight = {
  id: string
  content: string
  segment_id: string
  start_time: number
  type: string
}

export type Segment = {
  id: string
  content: string
  end_time: number
  meeting_id: string
  start_time: number
}

export type MeetingDetailLoaderData = {
  meeting: Meeting
  insights: Array<Insight>
  segments: Array<Segment>
}

export async function getMeetings() {
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching meetings:', error)
  }

  return (meetings ?? []) as Array<Meeting>
}

export async function getMeetingDetail(
  meetingId: string,
): Promise<MeetingDetailLoaderData> {
  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single()

  if (!meeting) {
    throw new Error('Meeting not found')
  }

  const { data: segments } = await supabase
    .from('segments')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('start_time', { ascending: true })

  const { data: insights } = await supabase
    .from('insights')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('start_time', { ascending: true })

  return {
    meeting: meeting as Meeting,
    insights: (insights ?? []) as Array<Insight>,
    segments: (segments ?? []) as Array<Segment>,
  }
}
