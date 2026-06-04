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
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const isSelfVoice = verificationType === 'self_voice'
  const steps = isSelfVoice ? SELF_STEPS : STEPS
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  const elapsedRemainder = elapsedSeconds % 60
  const elapsedText = `${elapsedMinutes}:${String(elapsedRemainder).padStart(2, '0')}`
  const isDelayed = elapsedSeconds >= 120
  const isLongRunning = elapsedSeconds >= 180

  useEffect(() => {
    if (analyzing) return
    setAnalyzing(true)
    setElapsedSeconds(0)

    const progressInterval = window.setInterval(() => {
      setProgress(prev => Math.min(90, prev + 7))
      setCurrentStep(prev => Math.min(steps.length - 1, prev + (Math.random() > 0.55 ? 1 : 0)))
    }, 750)
    const elapsedInterval = window.setInterval(() => {
      setElapsedSeconds(prev => prev + 1)
    }, 1000)

    const doAnalysis = async () => {
      try {
        const analysisResult = await startAnalysis(fileId, voiceSampleId || undefined)
        window.clearInterval(progressInterval)
        window.clearInterval(elapsedInterval)
        setProgress(95)
        setCurrentStep(steps.length - 1)

        const resultsData = await getResults(analysisResult.analysis_id)
        setProgress(100)
        window.setTimeout(() => {
          onComplete(analysisResult.analysis_id, analysisResult, resultsData)
        }, 500)
      } catch (e) {
        window.clearInterval(progressInterval)
        window.clearInterval(elapsedInterval)
        setError(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.')
      }
    }

    doAnalysis()
    return () => {
      window.clearInterval(progressInterval)
      window.clearInterval(elapsedInterval)
    }
  }, [fileId, voiceSampleId, onComplete, analyzing, steps.length])

  if (error) {
    return (
      <div className="flex min-h-[700px] flex-col justify-center">
        <div className="rounded-[28px] border border-red-100 bg-red-50 p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white">
            <Brain className="h-8 w-8 text-red-500" />
          </div>
          <p className="mt-5 text-[22px] font-black text-red-700">분석 오류</p>
          <p className="mt-2 text-[15px] font-bold leading-[1.42] text-red-600">{error}</p>
          <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-[15px] font-semibold leading-[1.42] text-red-500">
            네트워크 상태나 파일 크기에 따라 분석 요청이 중단될 수 있습니다. 같은 파일로 다시 시도하거나, 새로고침 후 다시 업로드해 주세요.
          </p>
          <Button onClick={onBack} className="mt-6 h-16 w-full rounded-full bg-[#0f7d82] text-[18px] font-black text-white shadow-none">
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
        <p className="mt-7 text-center text-[27px] font-black">{isSelfVoice ? '내 목소리 분석 중' : '통화 음성 분석 중'}</p>
        <p className="mt-2 text-center text-[16px] font-semibold leading-[1.42] text-white/80">
          {isSelfVoice
            ? '본인 음성의 위험 신호 참고 리포트를 준비하고 있습니다.'
            : '자녀 음성을 제외하고 부모님 음성의 위험 신호 리포트를 준비하고 있습니다.'}
        </p>
        <div className="mt-5 rounded-2xl bg-white/12 px-4 py-3 text-center">
          <p className="text-[16px] font-black text-white">
            보통 2~3분 정도 걸릴 수 있습니다
          </p>
          <p className="mt-1 text-[15px] font-bold text-white/75">
            경과 시간 {elapsedText}
          </p>
        </div>
        <div className="mt-7 space-y-2">
          <div className="flex justify-between text-[15px] font-black text-white/85">
            <span>{steps[currentStep].label}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-white/20" />
        </div>
        {isDelayed && (
          <p className={`mt-4 rounded-2xl px-4 py-3 text-center text-[15px] font-bold leading-[1.42] ${
            isLongRunning ? 'bg-white text-[#0d777c]' : 'bg-white/10 text-white/80'
          }`}>
            {isLongRunning
              ? '분석이 예상보다 오래 걸리고 있습니다. 결과가 곧 표시되지 않으면 네트워크 상태를 확인한 뒤 다시 시도해 주세요.'
              : '파일 길이와 서버 상태에 따라 조금 더 걸릴 수 있습니다. 창을 닫지 말고 잠시만 기다려 주세요.'}
          </p>
        )}
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
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                isDone ? 'bg-[#0f7d82] text-white' : isActive ? 'bg-[#d7efea] text-[#0f7d82]' : 'bg-[#f0f5f3] text-[#9aaeac]'
              }`}>
                {isDone ? <CheckCircle className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
              </div>
              <div>
                <p className="text-[17px] font-black text-[#183f40]">{step.label}</p>
                <p className="mt-0.5 text-[14px] font-semibold leading-[1.42] text-[#7d9593]">{step.detail}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
