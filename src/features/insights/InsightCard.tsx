import { motion } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import type { Insight } from '#/types/transcripts'

type InsightType =
  | 'action_item'
  | 'decision'
  | 'risk'
  | 'task'
  | 'update'
  | 'none'

const insightStyles: Record<
  InsightType,
  {
    badge: string
    glow: string
  }
> = {
  action_item: {
    badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    glow: 'from-amber-500/5 to-orange-500/5',
  },
  decision: {
    badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    glow: 'bg-green-500/2',
  },
  risk: {
    badge: 'text-red-400 bg-red-500/10 border-red-500/20',
    glow: 'bg-rose-500/5',
  },
  task: {
    badge: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    glow: 'bg-blue-500/5',
  },
  update: {
    badge: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    glow: 'bg-purple-500/5',
  },
  none: {
    badge: 'text-zinc-500 bg-zinc-800/50 border-zinc-700/30',
    glow: '',
  },
}

type Props = {
  insight: Insight
}

export function InsightCard({ insight }: Props) {
  const type = (insight.type as InsightType) ?? 'none'
  const style = insightStyles[type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: 1, y: 20 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="group relative bg-gradient-to-br from-zinc-900/90 to-zinc-900/50 backdrop-blur-xl rounded-md p-5 border border-zinc-800/50 hover:border-zinc-700/70 transition-all duration-300 overflow-hidden"
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br from-transparent to-transparent ${style.glow} transition-all duration-500 rounded-md`}
      />

      <div className="flex items-start gap-3">
        <div className="min-w-[95px]">
          <div
            className={`mt-1 p-2 rounded-md flex justify-center text-xs font-semibold uppercase tracking-wider border ${style.badge}`}
          >
            {insight.type}
          </div>

          <div className="text-xs text-zinc-400 break-all mt-2 flex gap-2">
            <p>Time</p>
            {insight.start_time && <p>{insight.start_time}</p>}
          </div>
        </div>

        <div className="min-w-0 flex-1 text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
          <ReactMarkdown>{insight.content}</ReactMarkdown>
          {/* <div>
            <button>Accept</button>
            <button>Decline</button>
          </div> */}
        </div>
      </div>
    </motion.div>
  )
}
