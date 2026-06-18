import { Link } from '@tanstack/react-router'
import { Calendar, Clock, ChevronRight } from 'lucide-react'
import type { Meeting } from '#/types/transcripts'
import { formatDateTime, formatMonthAbbr } from '#/lib/utils'
import Header from '#/components/Header'

function MeetingsDashboard({ meetings }: { meetings: Meeting[] }) {
  return (
    <div className="min-h-screen bg-black text-white p-6 relative">
      {/* Header */}
      <Header>
        <Link
          to="/"
          className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-sm font-medium rounded-md transition-colors border border-zinc-800"
          style={{ color: 'black' }}
        >
          Start New Meeting
        </Link>
      </Header>

      <div className="max-w-5xl mx-auto space-y-8 pt-20">
        {/* Meetings Grid */}
        {meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-zinc-950 rounded-md border border-zinc-900">
            <Calendar className="w-12 h-12 text-zinc-800 mb-4" />
            <h3 className="text-zinc-400 font-medium text-lg">
              No meetings yet
            </h3>
            <p className="text-zinc-600 text-sm max-w-sm mt-2">
              Once you record a meeting, it will appear here for historical
              review.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetings.map((meeting) => {
              return (
                <Link
                  key={meeting.id}
                  to="/meetings/$meetingId"
                  params={{ meetingId: meeting.id }}
                  className="group block bg-gradient-to-br from-zinc-900/90 to-zinc-900/50 backdrop-blur-xl border border-zinc-800 hover:border-zinc-700/80 rounded-md p-5 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-zinc-800/50"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden shrink-0">
                      <div className="px-3 py-2 flex flex-col items-center justify-center bg-zinc-900/50 border-r border-zinc-800">
                        <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
                          {formatMonthAbbr(meeting.createdAt)}
                        </span>
                        <span className="text-lg font-bold text-zinc-200">
                          {new Date(meeting.createdAt).getDate()}
                        </span>
                      </div>
                    </div>
                    <div className="p-1.5 rounded-full bg-zinc-800/50 text-zinc-400 group-hover:text-cyan-400 group-hover:bg-cyan-500/10 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="text-white font-semibold mb-2 line-clamp-1 group-hover:text-cyan-400 transition-colors">
                    {meeting.title || 'Untitled Session'}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDateTime(meeting.createdAt)}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default MeetingsDashboard
