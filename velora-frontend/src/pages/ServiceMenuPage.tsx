import { BarChart3, ChevronRight, Mic, PhoneCall, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ServiceMenuPageProps {
  onParentCall: () => void
  onSelfVoice: () => void
  onHistory: () => void
}

export default function ServiceMenuPage({ onParentCall, onSelfVoice, onHistory }: ServiceMenuPageProps) {
  return (
    <div className="space-y-5 pt-2">
      <section className="rounded-[30px] bg-white px-5 py-7 text-center shadow-sm shadow-teal-950/5">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#d7efea]">
          <div className="flex h-18 w-18 items-center justify-center rounded-full bg-[#15908e] p-4 text-white">
            <PhoneCall className="h-10 w-10" />
          </div>
        </div>
        <p className="mt-5 text-[22px] font-black text-[#183f40]">서비스 시작</p>
        <p className="mt-2 text-[12px] leading-5 text-[#607b79]">
          부모님 통화 또는 내 목소리를 선택해 새 검증을 시작할 수 있습니다.
        </p>
      </section>

      <section className="space-y-3">
        <Button
          onClick={onParentCall}
          className="h-14 w-full rounded-full bg-[#0f7d82] text-[15px] font-black text-white shadow-none hover:bg-[#0b6f74]"
        >
          <PhoneCall className="mr-2 h-4 w-4" />
          부모님 통화 검증
        </Button>

        <Button
          onClick={onSelfVoice}
          variant="outline"
          className="h-14 w-full rounded-full border-[#dce9e6] bg-white text-[15px] font-black text-[#0f7d82] shadow-none hover:bg-[#f4faf8]"
        >
          <Mic className="mr-2 h-4 w-4" />
          내 목소리 검증
        </Button>

        <button
          onClick={onHistory}
          className="flex w-full items-center justify-between rounded-2xl border border-[#e3ece9] bg-white px-4 py-4 shadow-sm shadow-teal-950/5"
        >
          <span className="flex items-center gap-3 text-[14px] font-black text-[#183f40]">
            <BarChart3 className="h-5 w-5 text-[#0f7d82]" />
            지난 검증 이력 보기
          </span>
          <ChevronRight className="h-5 w-5 text-[#8aa09e]" />
        </button>
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-[#f7fbfa] px-4 py-3 text-[11px] leading-5 text-[#7d9593]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7d82]" />
        본 서비스는 의료 진단이 아닌 비의료적 참고 정보를 제공합니다.
      </p>
    </div>
  )
}
