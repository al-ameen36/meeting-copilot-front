import { supabase } from '#/lib/supabase'
import type { Insight } from '#/types/transcripts'

/**
 * Adapter that fetches insights for a given meeting.
 * This isolates Supabase specifics behind a clear seam (`getInsights`).
 */
export async function getInsights(meetingId: string): Promise<Insight[]> {
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('meeting_id', meetingId)

  if (error) {
    console.error('Failed to fetch insights', error)
    // Return empty array to keep UI stable; callers can handle empty state.
    return []
  }

  // Ensure timestamps are numbers (seconds) – Supabase may return strings.
  return data.map((insight) => ({
    id: insight.id,
    type: insight.type,
    text: insight.text,
    // Some rows may lack timestamp; keep undefined if null/undefined.
    timestamp: insight.timestamp ? Number(insight.timestamp) : undefined,
  }))
}
