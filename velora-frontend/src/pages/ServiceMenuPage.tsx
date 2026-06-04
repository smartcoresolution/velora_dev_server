import { BarChart3, BookOpenText, ChevronRight, Mic, PhoneCall, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ServiceMenuPageProps {
  onParentCall: () => void
  onSelfVoice: () => void
  onHistory: () => void
  onRecordingGuide: () => void
}

export default function ServiceMenuPage({ onParentCall, onSelfVoice, onHistory, onRecordingGuide }: ServiceMenuPageProps) {
  return (
    <div className="space-y-5 pt-2">
      <section className="rounded-[30px] bg-white px-5 py-7 text-center shadow-sm shadow-teal-950/5">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#d7efea]">
          <div className="flex h-18 w-18 items-center justify-center rounded-full bg-[#15908e] p-4 text-white">
            <PhoneCall className="h-10 w-10" />
          </div>
        </div>
        <p className="mt-5 whitespace-pre-line text-[16px] font-semibold leading-7 text-[#607b79]">
          어떤 음성을 분석할까요?{'\n'}부모님 통화와 내 목소리 중 하나를 선택해 주세요.
        </p>
      </section>

      <section className="space-y-3">
        <Button
          onClick={onParentCall}
          className="h-16 w-full rounded-full bg-[#0f7d82] text-[18px] font-black text-white shadow-none hover:bg-[#0b6f74]"
        >
          <PhoneCall className="mr-2 h-5 w-5" />
          부모님 통화 검증
        </Button>

        <Button
          onClick={onSelfVoice}
          variant="outline"
          className="h-16 w-full rounded-full border-[#dce9e6] bg-white text-[18px] font-black text-[#0f7d82] shadow-none hover:bg-[#f4faf8]"
        >
          <Mic className="mr-2 h-5 w-5" />
          내 목소리 검증
        </Button>

        <button
          onClick={onRecordingGuide}
          className="flex min-h-[64px] w-full items-center justify-between rounded-2xl border border-[#e3ece9] bg-white px-4 py-4 shadow-sm shadow-teal-950/5"
        >
          <span className="flex items-center gap-3 text-[17px] font-black text-[#183f40]">
            <BookOpenText className="h-6 w-6 text-[#0f7d82]" />
            부모님 통화 녹음 가이드
          </span>
          <ChevronRight className="h-6 w-6 text-[#8aa09e]" />
        </button>

        <button
          onClick={onHistory}
          className="flex min-h-[64px] w-full items-center justify-between rounded-2xl border border-[#e3ece9] bg-white px-4 py-4 shadow-sm shadow-teal-950/5"
        >
          <span className="flex items-center gap-3 text-[17px] font-black text-[#183f40]">
            <BarChart3 className="h-6 w-6 text-[#0f7d82]" />
            지난 검증 이력 보기
          </span>
          <ChevronRight className="h-6 w-6 text-[#8aa09e]" />
        </button>
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-[#f7fbfa] px-4 py-4 text-[14px] font-semibold leading-6 text-[#7d9593]">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0f7d82]" />
        본 서비스는 의료 진단이 아닌 비의료적 참고 정보를 제공합니다.
      </p>
    </div>
  )
}
