import { useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState, useMemo } from 'react'
import { LogOut, History, MessageSquare } from 'lucide-react'

import { useWhisperStream } from '#/features/live-meeting/useWhisperStream'
import { supabase } from '#/lib/supabase'
import { useAuth } from '#/features/auth/AuthContext'
import { useNetwork } from '#/hooks/use-network'

import { TranscriptDisplay } from '#/features/transcript/TranscriptDisplay'
import { InsightCard } from '#/features/insights/InsightCard'
import { SourceSelector } from '#/components/SourceSelector'
import { StartButton } from '#/components/StartButton'
import { ChatPanel } from '#/features/chat/ChatPanel'

type FilterType =
  | 'all'
  | 'action_item'
  | 'decision'
  | 'risk'
  | 'follow_up'
  | 'update'

export default function LiveMeetingPage() {
  const navigate = useNavigate()
  const { active, segments, liveText, insights, start, stop, meetingId } =
    useWhisperStream()

  const { user, isLoading } = useAuth()
  const { isOnline } = useNetwork()

  const [source, setSource] = useState<'mic' | 'tab'>('mic')
  const [disableRecBtn, setDisableRecBtn] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    return () => {
      if (active) stop()
    }
  }, [active, stop])

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: '/login' })
    }
  }, [user, isLoading, navigate])

  const toggleSession = async () => {
    setDisableRecBtn(true)

    if (active) {
      stop()
      setDisableRecBtn(false)
      return
    }

    start(source)
    setDisableRecBtn(false)
  }

  const filteredInsights = useMemo(() => {
    if (filter === 'all') return insights
    return insights.filter((i) => i.type === filter)
  }, [insights, filter])

  const filters: FilterType[] = [
    'all',
    'action_item',
    'decision',
    'risk',
    'follow_up',
    'update',
  ]

  if (isLoading) {
    return <div className="min-h-screen bg-black" />
  }

  if (!user) {
    return null
  }

  return (
    <div className="size-full bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 text-white overflow-auto relative">
      <div className="max-w-5xl mx-auto p-6 space-y-8 min-h-screen relative z-10">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  active ? 'bg-green-400' : 'bg-zinc-600'
                }`}
              />
              {active && (
                <div className="absolute inset-0 rounded-full bg-green-400 animate-ping" />
              )}
            </div>

            <span className="text-sm text-zinc-400 uppercase tracking-wider font-semibold">
              {active ? 'LIVE' : 'IDLE'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <StartButton
                isRecording={active}
                onClick={toggleSession}
                disabled={!isOnline || disableRecBtn}
              />
              <SourceSelector
                selectedSource={source}
                onSourceChange={setSource}
              />
            </div>

            <div className="flex items-center gap-2">
              {meetingId && (
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors text-sm font-medium"
                  title="Chat with Meeting"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Chat</span>
                </button>
              )}

              <Link
                to="/meetings"
                className="p-2 ml-2 text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-md transition-all duration-200"
                title="Past Meetings"
              >
                <History className="w-6 h-6" />
              </Link>

              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  window.location.href = '/login'
                }}
                className="p-2 text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-md transition-all duration-200"
                title="Sign Out"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* TRANSCRIPT */}
        <TranscriptDisplay
          segments={segments}
          liveText={liveText}
          isListening={active}
        />

        {/* INSIGHTS */}
        <div className="space-y-4 flex-1 pb-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Insights
            </h2>

            {/* FILTER */}
            <div className="flex gap-2 flex-wrap">
              {filters.map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-3 py-1 text-xs rounded-md border transition ${
                    filter === type
                      ? 'bg-zinc-800 border-zinc-600 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {filteredInsights.length > 0 ? (
            <div className="space-y-3 h-[500px] overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-zinc-700">
              {filteredInsights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-zinc-500 text-sm">
                No insights for this filter
              </p>
            </div>
          )}
        </div>
      </div>

      {meetingId && (
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          meetingId={meetingId}
        />
      )}
    </div>
  )
}
