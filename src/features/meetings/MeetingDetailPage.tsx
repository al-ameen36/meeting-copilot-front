import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeft, Clock, CalendarDays, MessageSquare } from 'lucide-react'
import { supabase } from '#/lib/supabase'
import { useState } from 'react'

import { InsightCard } from '#/features/insights/InsightCard'
import { ChatPanel } from '#/features/chat/ChatPanel'
import type { Insight, Meeting, Segment } from '#/types/transcripts'
import { formatTime } from '#/lib/utils'

export const Route = createFileRoute('/meetings/$meetingId')({
  component: MeetingDetail,
  loader: async ({ params }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw redirect({ to: '/login' })
    }

    const { meetingId } = params

    const { data: meeting } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single()

    if (!meeting) {
      throw new Error('Meeting not found')
    }

    const { data: insights } = await supabase
      .from('insights')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('start_time', { ascending: true })

    const { data: segments } = await supabase
      .from('segments')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('start_time', { ascending: true })

    console.log(meeting)
    console.log(segments)

    return {
      meeting: meeting as Meeting,
      insights: (insights ?? []) as Insight[],
      segments: (segments ?? []) as Segment[],
    }
  },
})

function MeetingDetail() {
  const { meeting, insights, segments } = Route.useLoaderData()
  const [isChatOpen, setIsChatOpen] = useState(false)

  const importantInsights = insights.filter(
    (i) =>
      i.type === 'action_item' || i.type === 'decision' || i.type === 'risk',
  )

  const generalInsights = insights.filter(
    (i) => i.type === 'follow_up' || i.type === 'update',
  )

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <Link
            to="/meetings"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-4 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-md flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-2">
                {meeting.title || 'Untitled Session'}
              </h1>
              <div className="flex items-center gap-4 text-sm text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4" />
                  <span>
                    {new Date(meeting.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date(meeting.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsChatOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors text-sm font-medium w-full sm:w-auto flex-shrink-0 mt-4 sm:mt-0"
            >
              <MessageSquare className="w-4 h-4" />
              Chat with Meeting
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-widest text-zinc-500 font-semibold">
              Session Transcript
            </h2>

            <div className="h-[60vh] bg-zinc-950 border border-zinc-900 rounded-md overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 p-4 space-y-3">
              {segments.length > 0 ? (
                segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                  >
                    <div className="mb-2 text-[11px] uppercase tracking-widest text-zinc-500">
                      {formatTime(segment.start_time)} →{' '}
                      {formatTime(segment.end_time)}
                    </div>
                    <div className="text-sm leading-relaxed text-zinc-100 whitespace-pre-wrap">
                      {segment.content}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-zinc-500 text-sm">
                    No transcript data was recorded for this meeting.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-sm uppercase tracking-widest text-amber-500 font-semibold mb-4 border-b border-zinc-900 pb-2">
                Important insights ({importantInsights.length})
              </h2>

              {importantInsights.length > 0 ? (
                <div className="space-y-3 h-[280px] overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
                  {importantInsights.map((insight, idx) => (
                    <InsightCard key={insight.id ?? idx} insight={insight} />
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">No important insights.</p>
              )}
            </div>

            <div>
              <h2 className="text-sm uppercase tracking-widest text-blue-500 font-semibold mb-4 border-b border-zinc-900 pb-2">
                General ({generalInsights.length})
              </h2>

              {generalInsights.length > 0 ? (
                <div className="space-y-3 h-[280px] overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-zinc-800">
                  {generalInsights.map((insight, idx) => (
                    <InsightCard key={insight.id ?? idx} insight={insight} />
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">No general insights.</p>
              )}
            </div>

            {insights.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 bg-zinc-950/50 rounded-md border border-zinc-800/50 border-dashed">
                <p className="text-zinc-500 text-sm">
                  No insights were detected.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        meetingId={meeting.id}
      />
    </div>
  )
}
