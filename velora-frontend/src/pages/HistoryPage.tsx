import { BarChart3, ChevronRight, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HistoryPageProps {
  items: Array<Record<string, any>>
  onSelect: (item: Record<string, any>) => void
  onRestart: () => void
  onDelete: (analysisId: string) => void
}

function toQualityLabel(score: number) {
  if (score >= 0.75) return '양호'
  if (score >= 0.5) return '보통'
  return '미흡'
}

const PATTERN_LABELS = {
  Normal: { label: '인지기능 위험 낮음', color: '#16a36a' },
  MCI: { label: '인지기능 변화 가능성 있음', color: '#f6a51a' },
  AD: { label: '치매 관련 위험 신호 높음', color: '#ef4444' },
}

function getPatternSummary(analysis: Record<string, any>) {
  const probabilities = analysis.model_probabilities || {}
  const rows = [
    { key: 'Normal', value: Number(probabilities.Normal || 0), ...PATTERN_LABELS.Normal },
    { key: 'MCI', value: Number(probabilities.MCI || 0), ...PATTERN_LABELS.MCI },
    { key: 'AD', value: Number(probabilities.AD || 0), ...PATTERN_LABELS.AD },
  ]
  return rows.reduce((top, row) => (row.value > top.value ? row : top), rows[0])
}

function formatDate(value: unknown) {
  if (!value) return '이전 검증 기록'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return '이전 검증 기록'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatShortDate(value: unknown) {
  if (!value) return '이전 기록'
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return '이전 기록'
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function HistoryPage({ items, onSelect, onRestart, onDelete }: HistoryPageProps) {
  const latestItem = items[0]
  const latestAnalysis = latestItem?.analysis as Record<string, any> | undefined
  const latestPattern = latestAnalysis ? getPatternSummary(latestAnalysis) : null
  const chartRows = items.slice(0, 5).map(item => {
    const analysis = item.analysis as Record<string, any>
    const pattern = getPatternSummary(analysis)
    const checkedAt = item.saved_at || item.created_at || analysis.created_at
    return {
      id: String(analysis.analysis_id || checkedAt),
      date: formatShortDate(checkedAt),
      value: Math.round(pattern.value * 100),
      label: pattern.label,
      color: pattern.color,
    }
  })

  return (
    <div className="space-y-4 pt-2">
      {items.length === 0 ? (
        <section className="flex min-h-[620px] flex-col items-center justify-center rounded-[28px] bg-white p-6 text-center">
          <BarChart3 className="h-12 w-12 text-[#0f7d82]" />
          <p className="mt-4 text-[17px] font-black text-[#183f40]">지난 검증 이력이 없습니다</p>
          <p className="mt-2 text-[12px] leading-5 text-[#7d9593]">새 검증을 완료하면 부모님 음성의 변화 이력이 이곳에 표시됩니다.</p>
          <Button onClick={onRestart} className="mt-6 h-12 w-full rounded-full bg-[#0f7d82] text-white shadow-none">
            <RefreshCw className="mr-2 h-4 w-4" />
            다시 새로 검증
          </Button>
        </section>
      ) : (
        <>
          {latestItem && latestAnalysis && latestPattern && (
            <section className="rounded-[26px] border border-[#dce9e6] bg-white p-5 shadow-sm shadow-teal-950/5">
              <p className="text-[13px] font-black text-[#183f40]">최근 검증 요약</p>
              <p className="mt-1 text-[11px] text-[#8aa09e]">가로축은 값, 세로축은 검증 날짜입니다.</p>

              <div className="mt-4 rounded-2xl bg-[#f1f8f6] p-4">
                <div className="mb-3 flex justify-between px-[76px] text-[10px] font-bold text-[#8aa09e]">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
                <div className="space-y-3">
                  {chartRows.map(row => (
                    <div key={row.id} className="grid grid-cols-[68px_1fr_36px] items-center gap-2">
                      <p className="truncate text-[10px] font-bold text-[#607b79]">{row.date}</p>
                      <div className="h-3 rounded-full bg-white">
                        <div className="h-full rounded-full" style={{ width: `${row.value}%`, backgroundColor: row.color }} />
                      </div>
                      <p className="text-right text-[11px] font-black text-[#183f40]">{row.value}%</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[12px] font-black text-[#183f40]">{chartRows[0]?.label}</p>
              </div>
            </section>
          )}

          <p className="px-1 text-[12px] font-black text-[#426160]">검증 이력</p>

          {items.map(item => {
            const analysis = item.analysis as Record<string, any>
            const confidenceScore = Number(analysis.confidence_score || 0)
            const confidencePercent = Math.round(confidenceScore * 100)
            const confidenceLabel = toQualityLabel(confidenceScore)
            const checkedAt = item.saved_at || item.created_at || analysis.created_at
            return (
              <div
                key={analysis.analysis_id}
                className="rounded-2xl border border-[#e3ece9] bg-white p-4 shadow-sm shadow-teal-950/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => onSelect(item)} className="min-w-0 flex-1 text-left">
                    <p className="text-[13px] font-black text-[#183f40]">{formatDate(checkedAt)}</p>
                    <p className="mt-1 text-[12px] leading-5 text-[#6f8785]">
                      결과 신뢰도 {confidenceLabel} · {confidencePercent}%
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => onDelete(String(analysis.analysis_id || ''))}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[#8aa09e] hover:bg-red-50 hover:text-red-500"
                      aria-label="이력 삭제"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onSelect(item)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[#8aa09e] hover:bg-[#f1f8f6]"
                      aria-label="결과 보기"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
