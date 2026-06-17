import { cn } from '#/lib/utils'

type Insight = {
  id: string
  type: string
  text: string
  /** optional timestamp in seconds */
  timestamp?: number
}

export default function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div
      className={cn(
        'rounded-md p-3 bg-zinc-800/60 text-sm text-zinc-100',
        'border border-zinc-700',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium capitalize text-zinc-300">
          {insight.type.replace('_', ' ')}
        </span>
        {insight.timestamp !== undefined && (
          <span className="text-xs text-zinc-500">
            {new Date(insight.timestamp * 1000).toLocaleTimeString([], {
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap">{insight.text}</p>
    </div>
  )
}
