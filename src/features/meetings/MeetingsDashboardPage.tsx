import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Calendar, Clock, ChevronRight, LogOut } from 'lucide-react'
import { supabase } from '#/lib/supabase'

type Meeting = {
  id: string
  title: string
  status: string
  start_time: string | null
  end_time: string | null
  created_at: string
}

export const Route = createFileRoute('/meetings/')({
  component: MeetingsDashboard,
  loader: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw redirect({ to: '/login' })
    }

    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching meetings:', error)
    }

    return { meetings: (meetings ?? []) as Meeting[] }
  },
})

function formatDisplayTime(dateString: string | null) {
  if (!dateString) return '--:--'
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(dateString))
}

function getDurationMinutes(start: string | null, end: string | null) {
  if (!start || !end) return null
  const diff = new Date(end).getTime() - new Date(start).getTime()
  return Math.round(diff / 60000)
}

function MeetingsDashboard() {
  const { meetings } = Route.useLoaderData()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header / Navigate */}
        <div className="flex items-center justify-between pb-6 border-b border-zinc-900">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Past Meetings
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Review your historical transcripts and extracted insights.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-sm font-medium rounded-md transition-colors border border-zinc-800"
              style={{ color: 'black' }}
            >
              Start New Meeting
            </Link>

            <button
              onClick={handleSignOut}
              className="p-2 text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-md transition-all duration-200"
              title="Sign Out"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>

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
              const duration = getDurationMinutes(
                meeting.start_time,
                meeting.end_time,
              )

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
                          {new Date(meeting.created_at).toLocaleString(
                            'en-US',
                            { month: 'short' },
                          )}
                        </span>
                        <span className="text-lg font-bold text-zinc-200">
                          {new Date(meeting.created_at).getDate()}
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
                      <span>{formatDisplayTime(meeting.start_time)}</span>
                    </div>
                    {duration !== null && (
                      <div className="flex items-center gap-1.5 text-zinc-600 bg-zinc-950 px-2 py-0.5 rounded-full border border-zinc-800">
                        {duration} min
                      </div>
                    )}
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
