import { Activity, ChevronRight, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ResultsPageProps {
  resultsData: Record<string, unknown> | null
  onRestart: () => void
  onReliability: () => void
}

const PROBABILITY_LABELS = {
  Normal: { label: '인지기능 위험 낮음', color: '#16a36a' },
  MCI: { label: '인지기능 변화 가능성 있음', color: '#f6a51a' },
  AD: { label: '치매 관련 위험 신호 높음', color: '#ef4444' },
}

export default function ResultsPage({ resultsData, onRestart, onReliability }: ResultsPageProps) {
  if (!resultsData) {
    return (
      <div className="flex min-h-[700px] flex-col justify-center text-center">
        <p className="text-[14px] font-semibold text-[#6f8785]">결과 데이터를 불러올 수 없습니다.</p>
        <Button onClick={onRestart} className="mt-5 h-12 rounded-full bg-[#0f7d82] text-white shadow-none">
          처음부터 다시 시작
        </Button>
      </div>
    )
  }

  const analysis = resultsData.analysis as Record<string, unknown>
  const isSelfVoice = resultsData.verification_type === 'self_voice'
  const probabilities = analysis.model_probabilities as Record<string, number>

  const probabilityRows = [
    { name: 'Normal', value: Number(probabilities?.Normal || 0), ...PROBABILITY_LABELS.Normal },
    { name: 'MCI', value: Number(probabilities?.MCI || 0), ...PROBABILITY_LABELS.MCI },
    { name: 'AD', value: Number(probabilities?.AD || 0), ...PROBABILITY_LABELS.AD },
  ]
  const topProbability = probabilityRows.reduce((top, row) => (row.value > top.value ? row : top), probabilityRows[0])

  return (
    <div className="space-y-5 pt-2">
      <section className="rounded-[30px] bg-white px-5 py-7 text-center shadow-sm shadow-teal-950/5">
        <div className="relative mx-auto h-52 w-52">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#0f7d82"
              strokeWidth="10"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="max-w-[130px] text-[20px] font-black leading-7 text-[#183f40]">{topProbability.label}</p>
          </div>
        </div>
        <p className="mt-2 text-[14px] font-bold leading-6 text-[#426160]">
          {isSelfVoice ? '내 목소리' : '부모님 음성'}에서 {topProbability.label} 신호가 가장 높게 관찰되었습니다.
        </p>
        <p className="mt-2 text-[12px] leading-5 text-[#7d9593]">
          세부 확률과 신뢰도는 결과 신뢰도 보기에서 확인해 주세요.
        </p>
      </section>

      <section className="space-y-3">
        <button onClick={onReliability} className="flex w-full items-center justify-between rounded-2xl bg-[#0f7d82] px-4 py-4 text-white">
          <span className="flex items-center gap-3 text-[14px] font-black">
            <Activity className="h-5 w-5" />
            결과 신뢰도 보기
          </span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-[#f7fbfa] px-4 py-3 text-[11px] leading-5 text-[#7d9593]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7d82]" />
        {analysis.disclaimer as string || '본 결과는 의료 진단이 아닌 비의료적 참고 정보입니다.'}
      </p>
      <Button
        onClick={onRestart}
        variant="outline"
        className="h-12 w-full rounded-full border-[#dce9e6] bg-white text-[14px] font-black text-[#0f7d82] shadow-none hover:bg-[#f4faf8]"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        다시 새로 검증
      </Button>
    </div>
  )
}
