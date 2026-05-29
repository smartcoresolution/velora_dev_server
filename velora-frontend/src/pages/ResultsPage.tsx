import { useState } from 'react'
import { Activity, AlertTriangle, BarChart3, ChevronRight, HeartPulse, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ResultsPageProps {
  resultsData: Record<string, unknown> | null
  onRestart: () => void
}

const RISK_STYLE = {
  low: { label: '안정', color: '#16a36a', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  middle: { label: '주의', color: '#f6a51a', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  caution: { label: '주의', color: '#f6a51a', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  high: { label: '높음', color: '#ef4444', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
}

export default function ResultsPage({ resultsData, onRestart }: ResultsPageProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [showCare, setShowCare] = useState(false)

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
  const guidance = (resultsData.guidance as Array<Record<string, unknown>>) || []
  const nextSteps = (resultsData.next_steps as string[]) || []
  const riskScore = Number(analysis.risk_score || 0)
  const riskLevel = String(analysis.risk_level || 'middle')
  const riskStyle = RISK_STYLE[riskLevel as keyof typeof RISK_STYLE] || RISK_STYLE.middle
  const confidenceScore = Number(analysis.confidence_score || 0)
  const probabilities = analysis.model_probabilities as Record<string, number>
  const features = analysis.features as Record<string, any>
  const linguistic = features?.linguistic_features as Record<string, unknown> | undefined
  const governance = analysis.governance as Record<string, unknown> | undefined
  const circumference = 314
  const arc = Math.min(circumference, Math.max(0, riskScore * 3.14))

  const probabilityRows = [
    { name: 'Normal', label: '정상', value: Math.round((probabilities?.Normal || 0) * 100), color: '#16a36a' },
    { name: 'MCI', label: 'MCI', value: Math.round((probabilities?.MCI || 0) * 100), color: '#f6a51a' },
    { name: 'AD', label: 'AD', value: Math.round((probabilities?.AD || 0) * 100), color: '#ef4444' },
  ]

  return (
    <div className="space-y-5 pt-2">
      <section className="rounded-[30px] bg-white px-5 py-7 text-center shadow-sm shadow-teal-950/5">
        <div className="relative mx-auto h-52 w-52">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#e6ece9" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={riskStyle.color}
              strokeWidth="10"
              strokeDasharray={`${arc} ${circumference - arc}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AlertTriangle className={`mb-2 h-8 w-8 ${riskStyle.text}`} />
            <p className="text-[38px] font-black text-[#183f40]">{riskScore.toFixed(0)}점</p>
            <span className={`mt-2 rounded-full px-4 py-1 text-[13px] font-black ${riskStyle.badge}`}>
              {analysis.risk_level_label as string || riskStyle.label}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[14px] font-bold leading-6 text-[#426160]">
          현재 인지 기능은 {analysis.dementia_stage as string || '주의 단계'}로 관리가 필요합니다.
        </p>
        <p className="mt-2 text-[12px] leading-5 text-[#7d9593]">
          일상 속 습관으로 두뇌를 더 건강하게 유지해 보세요.
        </p>
      </section>

      <section className="rounded-2xl bg-[#eff9f6] p-4">
        <p className="text-[13px] font-black text-[#183f40]">학습 모델 판별</p>
        <p className="mt-2 text-[12px] leading-5 text-[#426160]">{analysis.result_message as string}</p>
        <div className="mt-4 space-y-3">
          {probabilityRows.map(row => (
            <div key={row.name}>
              <div className="mb-1 flex justify-between text-[12px] font-bold text-[#426160]">
                <span>{row.label}</span>
                <span>{row.value}%</span>
              </div>
              <div className="h-2 rounded-full bg-white">
                <div className="h-full rounded-full" style={{ width: `${row.value}%`, backgroundColor: row.color }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm shadow-teal-950/5">
          <p className="text-[11px] text-[#7d9593]">신뢰도</p>
          <p className="mt-1 text-[18px] font-black text-[#183f40]">{Math.round(confidenceScore * 100)}%</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm shadow-teal-950/5">
          <p className="text-[11px] text-[#7d9593]">판별 결과</p>
          <p className="mt-1 text-[18px] font-black text-[#183f40]">{analysis.cognitive_status_label as string}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm shadow-teal-950/5">
          <p className="text-[11px] text-[#7d9593]">위험 확률</p>
          <p className="mt-1 text-[18px] font-black text-[#183f40]">{(Number(analysis.risk_probability || 0) * 100).toFixed(0)}%</p>
        </div>
      </section>

      <section className="space-y-3">
        <button onClick={() => setShowDetails(prev => !prev)} className="flex w-full items-center justify-between rounded-2xl bg-[#0f7d82] px-4 py-4 text-white">
          <span className="flex items-center gap-3 text-[14px] font-black">
            <Activity className="h-5 w-5" />
            상세 결과 보기
          </span>
          <ChevronRight className="h-5 w-5" />
        </button>
        <button onClick={() => setShowCare(prev => !prev)} className="flex w-full items-center justify-between rounded-2xl border border-[#e3ece9] bg-white px-4 py-4">
          <span className="flex items-center gap-3 text-[14px] font-black text-[#183f40]">
            <HeartPulse className="h-5 w-5 text-[#0f7d82]" />
            맞춤 인지 케어 추천
          </span>
          <ChevronRight className="h-5 w-5 text-[#8aa09e]" />
        </button>
        <button className="flex w-full items-center justify-between rounded-2xl border border-[#e3ece9] bg-white px-4 py-4">
          <span className="flex items-center gap-3 text-[14px] font-black text-[#183f40]">
            <BarChart3 className="h-5 w-5 text-[#0f7d82]" />
            이 리포트는 이력에 저장됨
          </span>
          <ChevronRight className="h-5 w-5 text-[#8aa09e]" />
        </button>
      </section>

      {showDetails && (
        <section className="rounded-2xl border border-[#e3ece9] bg-white p-4">
          <p className="text-[13px] font-black text-[#183f40]">상세 분석 지표</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#f7fbfa] p-3">
              <p className="text-[11px] text-[#7d9593]">언어 특징</p>
              <p className="mt-1 text-[12px] font-black text-[#183f40]">{linguistic?.transcript_available ? '전사 분석 완료' : '전사 미제공'}</p>
            </div>
            <div className="rounded-xl bg-[#f7fbfa] p-3">
              <p className="text-[11px] text-[#7d9593]">어휘 다양성</p>
              <p className="mt-1 text-[12px] font-black text-[#183f40]">{Number(linguistic?.vocabulary_diversity || 0).toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-[#f7fbfa] p-3">
              <p className="text-[11px] text-[#7d9593]">원본 음성 삭제</p>
              <p className="mt-1 text-[12px] font-black text-[#183f40]">{governance?.raw_audio_deleted_after_analysis ? '완료' : '대기'}</p>
            </div>
            <div className="rounded-xl bg-[#f7fbfa] p-3">
              <p className="text-[11px] text-[#7d9593]">저장 범위</p>
              <p className="mt-1 text-[12px] font-black text-[#183f40]">특징/결과</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[#7d9593]">{linguistic?.extraction_note as string}</p>
        </section>
      )}

      {guidance.length > 0 && (
        <section className={`rounded-2xl border border-[#e3ece9] bg-white p-4 ${showCare ? '' : 'hidden'}`}>
          <p className="text-[13px] font-black text-[#183f40]">안내 및 권고사항</p>
          <div className="mt-3 space-y-3">
            {guidance.slice(0, 3).map((item, idx) => (
              <div key={idx} className="rounded-xl bg-[#f7fbfa] px-3 py-3">
                <p className="text-[12px] font-black text-[#183f40]">{item.title as string}</p>
                <p className="mt-1 text-[11px] leading-5 text-[#6f8785]">{item.description as string}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {nextSteps.length > 0 && (
        <section className="rounded-2xl border border-[#e3ece9] bg-white p-4">
          <p className="text-[13px] font-black text-[#183f40]">다음 단계</p>
          <div className="mt-3 space-y-2">
            {nextSteps.slice(0, 3).map((step, idx) => (
              <p key={idx} className="flex gap-2 text-[12px] leading-5 text-[#426160]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d7efea] text-[11px] font-black text-[#0f7d82]">
                  {idx + 1}
                </span>
                {step}
              </p>
            ))}
          </div>
        </section>
      )}

      <p className="flex items-start gap-2 rounded-2xl bg-[#f7fbfa] px-4 py-3 text-[11px] leading-5 text-[#7d9593]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7d82]" />
        {analysis.disclaimer as string || '본 결과는 의료 진단이 아닌 비의료적 참고 정보입니다.'}
      </p>

      <Button
        onClick={onRestart}
        className="h-14 w-full rounded-full bg-[#0f7d82] text-[15px] font-black text-white shadow-none hover:bg-[#0b6f74]"
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        새 분석 시작하기
      </Button>
    </div>
  )
}
