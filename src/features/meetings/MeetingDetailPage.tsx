import { Link } from '@tanstack/react-router'
import { ArrowLeft, Clock, CalendarDays, MessageSquare } from 'lucide-react'
import { useState } from 'react'

import { ChatPanel } from '#/features/chat/ChatPanel'
import InsightCard from '#/components/InsightCard'
import Header from '#/components/Header'
import type { Meeting, Segment } from '#/types/transcripts'
import { formatTime, formatDate, formatDateTime } from '#/lib/utils'

function MeetingDetail({
  meeting,
  segments,
  insights,
}: {
  meeting: Meeting
  segments: Segment[]
  insights: any[]
}) {
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* HEADER */}
        <Header>
          <Link
            to="/meetings"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-4 text-sm font-medium"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-2">
              {meeting.title || 'Untitled Session'}
            </h1>
            <div className="flex items-center gap-4 text-sm text-zinc-500">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                <span>{formatDate(meeting.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{formatDateTime(meeting.createdAt)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsChatOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors text-sm font-medium w-full sm:w-auto flex-shrink-0 mt-4 sm:mt-0"
          >
            <MessageSquare className="w-4 h-4" />
            Ask Anything
          </button>
        </Header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-30">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-widest text-zinc-500 font-semibold">
              Session Transcript
            </h2>

            <div className="space-y-3">
              {segments.length > 0 ? (
                segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="rounded-md bg-zinc-900/60 px-4 py-3"
                  >
                    <div className="mb-2 text-[11px] uppercase tracking-widest text-zinc-500">
                      {formatTime(segment.start)} → {formatTime(segment.end)}
                    </div>
                    <div className="text-sm leading-relaxed text-zinc-100 whitespace-pre-wrap">
                      {segment.text}
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
        </div>
        {/* Insights Section */}
        {insights.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm uppercase tracking-widest text-zinc-500 font-semibold mb-2">
              Insights
            </h2>
            <div className="space-y-3">
              {insights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </div>
        )}

        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          meetingId={meeting.id}
        />
      </div>
    </div>
  )
}

export default MeetingDetail
