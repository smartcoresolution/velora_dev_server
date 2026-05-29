import { BarChart3, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HistoryPageProps {
  items: Array<Record<string, any>>
  onSelect: (item: Record<string, any>) => void
  onRestart: () => void
}

export default function HistoryPage({ items, onSelect, onRestart }: HistoryPageProps) {
  return (
    <div className="space-y-4 pt-2">
      {items.length === 0 ? (
        <section className="flex min-h-[620px] flex-col items-center justify-center rounded-[28px] bg-white p-6 text-center">
          <BarChart3 className="h-12 w-12 text-[#0f7d82]" />
          <p className="mt-4 text-[17px] font-black text-[#183f40]">저장된 이력이 없습니다</p>
          <p className="mt-2 text-[12px] leading-5 text-[#7d9593]">분석을 완료하면 최근 리포트가 이곳에 표시됩니다.</p>
          <Button onClick={onRestart} className="mt-6 h-12 w-full rounded-full bg-[#0f7d82] text-white shadow-none">
            <RefreshCw className="mr-2 h-4 w-4" />
            새 분석 시작
          </Button>
        </section>
      ) : (
        items.map(item => {
          const analysis = item.analysis as Record<string, any>
          return (
            <button
              key={analysis.analysis_id}
              onClick={() => onSelect(item)}
              className="flex w-full items-center justify-between rounded-2xl border border-[#e3ece9] bg-white p-4 text-left shadow-sm shadow-teal-950/5"
            >
              <div>
                <p className="text-[13px] font-black text-[#183f40]">{analysis.risk_score?.toFixed?.(0) || analysis.risk_score}점 · {analysis.risk_level_label}</p>
                <p className="mt-1 text-[12px] text-[#6f8785]">{analysis.dementia_stage}</p>
                <p className="mt-2 text-[11px] text-[#8aa09e]">{analysis.analysis_id}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#8aa09e]" />
            </button>
          )
        })
      )}
    </div>
  )
}
