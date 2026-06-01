import { useEffect, useState } from 'react'
import { AudioWaveform, BarChart3, Brain, CheckCircle, Shield, UserRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { startAnalysis, getResults } from '@/lib/api'

interface AnalyzingPageProps {
  fileId: string
  voiceSampleId: string
  verificationType: 'parent_call' | 'self_voice'
  onComplete: (analysisId: string, analysisResult: Record<string, unknown>, resultsData: Record<string, unknown>) => void
  onBack: () => void
}

const STEPS = [
  { icon: AudioWaveform, label: '통화 전처리', detail: 'm4a 파일을 표준 음성으로 변환합니다.' },
  { icon: Users, label: '자녀 음성 제외', detail: '등록된 자녀 음성과 통화 속 화자를 비교합니다.' },
  { icon: BarChart3, label: '부모 음성 분석', detail: '부모님 발화의 음성 특징을 계산합니다.' },
  { icon: Brain, label: '위험 신호 추론', detail: '인지기능 변화 관련 위험 신호를 산출합니다.' },
  { icon: Shield, label: '리포트 생성', detail: '비의료적 참고 리포트를 정리합니다.' },
]

const SELF_STEPS = [
  { icon: AudioWaveform, label: '음성 전처리', detail: '녹음 파일을 표준 음성으로 변환합니다.' },
  { icon: UserRound, label: '본인 음성 확인', detail: '본인 발화의 길이와 품질을 확인합니다.' },
  { icon: BarChart3, label: '음성 특징 분석', detail: '말 속도, 멈춤, 에너지 특징을 계산합니다.' },
  { icon: Brain, label: '위험 신호 추론', detail: '인지기능 변화 관련 참고 신호를 산출합니다.' },
  { icon: Shield, label: '리포트 생성', detail: '비의료적 참고 리포트를 정리합니다.' },
]

export default function AnalyzingPage({ fileId, voiceSampleId, verificationType, onComplete, onBack }: AnalyzingPageProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const isSelfVoice = verificationType === 'self_voice'
  const steps = isSelfVoice ? SELF_STEPS : STEPS

  useEffect(() => {
    if (analyzing) return
    setAnalyzing(true)

    const progressInterval = window.setInterval(() => {
      setProgress(prev => Math.min(90, prev + 7))
      setCurrentStep(prev => Math.min(steps.length - 1, prev + (Math.random() > 0.55 ? 1 : 0)))
    }, 750)

    const doAnalysis = async () => {
      try {
        const analysisResult = await startAnalysis(fileId, voiceSampleId || undefined)
        window.clearInterval(progressInterval)
        setProgress(95)
        setCurrentStep(steps.length - 1)

        const resultsData = await getResults(analysisResult.analysis_id)
        setProgress(100)
        window.setTimeout(() => {
          onComplete(analysisResult.analysis_id, analysisResult, resultsData)
        }, 500)
      } catch (e) {
        window.clearInterval(progressInterval)
        setError(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.')
      }
    }

    doAnalysis()
    return () => window.clearInterval(progressInterval)
  }, [fileId, voiceSampleId, onComplete, analyzing, steps.length])

  if (error) {
    return (
      <div className="flex min-h-[700px] flex-col justify-center">
        <div className="rounded-[28px] border border-red-100 bg-red-50 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white">
            <Brain className="h-8 w-8 text-red-500" />
          </div>
          <p className="mt-5 text-[18px] font-black text-red-700">분석 오류</p>
          <p className="mt-2 text-[13px] leading-5 text-red-600">{error}</p>
          <Button onClick={onBack} className="mt-6 h-12 w-full rounded-full bg-[#0f7d82] text-white shadow-none">
            다시 시도
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[700px] flex-col justify-center pt-2">
      <div className="rounded-[32px] bg-[#0d777c] px-6 py-8 text-white shadow-lg shadow-teal-900/15">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-white/20">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
            <Brain className="h-11 w-11" />
          </div>
        </div>
        <p className="mt-7 text-center text-[23px] font-black">{isSelfVoice ? '내 목소리 분석 중' : '통화 음성 분석 중'}</p>
        <p className="mt-2 text-center text-[13px] leading-5 text-white/75">
          {isSelfVoice
            ? '본인 음성의 위험 신호 참고 리포트를 준비하고 있습니다.'
            : '자녀 음성을 제외하고 부모님 음성의 위험 신호 리포트를 준비하고 있습니다.'}
        </p>
        <div className="mt-7 space-y-2">
          <div className="flex justify-between text-[12px] font-bold text-white/80">
            <span>{steps[currentStep].label}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-white/20" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const isActive = idx === currentStep
          const isDone = idx < currentStep || progress >= 100
          return (
            <div
              key={step.label}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                isActive ? 'border-[#0f7d82] bg-[#eff9f6]' : 'border-[#e3ece9] bg-white'
              }`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                isDone ? 'bg-[#0f7d82] text-white' : isActive ? 'bg-[#d7efea] text-[#0f7d82]' : 'bg-[#f0f5f3] text-[#9aaeac]'
              }`}>
                {isDone ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-[13px] font-black text-[#183f40]">{step.label}</p>
                <p className="mt-0.5 text-[11px] text-[#7d9593]">{step.detail}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
