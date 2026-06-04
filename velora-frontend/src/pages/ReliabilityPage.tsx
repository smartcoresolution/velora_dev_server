import { Activity, CalendarCheck, ClipboardList, RefreshCw, Stethoscope } from 'lucide-react'

interface ReliabilityPageProps {
  resultsData: Record<string, unknown> | null
}

const PROBABILITY_LABELS = {
  Normal: { label: '인지기능 위험 낮음', color: '#16a36a' },
  MCI: { label: '인지기능 변화 가능성 있음', color: '#f6a51a' },
  AD: { label: '치매 관련 위험 신호 높음', color: '#ef4444' },
}

const PATTERN_LABELS = {
  Normal: '위험 신호가 적은 패턴',
  MCI: '가벼운 변화 가능성 패턴',
  AD: '강한 위험 신호 패턴',
}

const FEATURE_LABELS = {
  Normal: '위험 신호가 적은 음성 특징이 보였습니다',
  MCI: '가벼운 변화 가능성 신호가 일부 보였습니다',
  AD: '강한 위험 신호는 낮게 나타났습니다',
}

export default function ReliabilityPage({ resultsData }: ReliabilityPageProps) {
  const analysis = resultsData?.analysis as Record<string, unknown> | undefined
  const isSelfVoice = resultsData?.verification_type === 'self_voice'
  const probabilities = analysis?.model_probabilities as Record<string, number> | undefined
  const probabilityRows = [
    { name: 'Normal', value: Math.round(Number(probabilities?.Normal || 0) * 100), ...PROBABILITY_LABELS.Normal },
    { name: 'MCI', value: Math.round(Number(probabilities?.MCI || 0) * 100), ...PROBABILITY_LABELS.MCI },
    { name: 'AD', value: Math.round(Number(probabilities?.AD || 0) * 100), ...PROBABILITY_LABELS.AD },
  ]
  const topPattern = probabilityRows.reduce((top, row) => (row.value > top.value ? row : top), probabilityRows[0])
  const auxiliarySignals = probabilityRows
    .filter(row => row.name !== topPattern.name && row.value > 0)
    .sort((a, b) => b.value - a.value)
  const hasMildChangePattern = topPattern.name === 'MCI'
  const hasStrongRiskPattern = topPattern.name === 'AD'

  return (
    <div className="space-y-4 pt-1">
      <section className="rounded-[18px] border border-[#eef3f1] bg-white px-5 py-7 text-center shadow-[0_6px_18px_rgba(15,63,64,0.08)]">
        <div className="mx-auto flex h-[86px] w-[86px] items-center justify-center rounded-full bg-[#dcefeb] text-[#0f8d8f]">
          <Activity className="h-12 w-12" />
        </div>
        <p className="mt-5 whitespace-pre-line text-[25px] font-black leading-[1.25] text-[#183f40]">
          이번 결과를{'\n'}어떻게 보면 될까요?
        </p>
        <p className="mt-3 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
          {isSelfVoice
            ? '본인 발화량, 음성 상태, 녹음 품질 등을 함께 살펴 이번 결과를 얼마나 참고할 수 있는지 쉽게 설명해드립니다.'
            : '부모님의 말한 양, 음성 상태, 통화 품질 등을 함께 살펴 이번 결과를 얼마나 참고할 수 있는지 쉽게 설명해드립니다.'}
        </p>
      </section>

      <section className="rounded-[18px] bg-white px-4 py-5 shadow-sm shadow-teal-950/5">
        <p className="text-[18px] font-black text-[#183f40]">AI가 본 이번 음성</p>
        <p className="mt-2 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
          아래 수치는 치매 진단 확률이 아닙니다.<br />
          이번 음성이 어떤 유형에 더 가깝게 나타났는지 보여주는 참고 정보입니다.
        </p>

        <div className="mt-4 rounded-[14px] border border-[#cfebe9] bg-[#f0faf8] px-4 py-3">
          <p className="text-[14px] font-black text-[#0f7d82]">이번 음성과 가장 비슷한 결과</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="min-w-0 text-[20px] font-black leading-[1.25] text-[#183f40]">
              {PATTERN_LABELS[topPattern.name as keyof typeof PATTERN_LABELS]}
            </p>
            <p className="shrink-0 text-[31px] font-black leading-none text-[#0f8d8f]">
              <span className="mr-1 align-middle text-[14px] font-black">참고값</span>
              {topPattern.value}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[16px] font-black text-[#183f40]">함께 보인 특징</p>
        <div className="mt-2 divide-y divide-[#edf3f1]">
          {auxiliarySignals.map(row => (
            <div key={row.name} className="flex items-center justify-between gap-3 py-2.5 text-[15px] font-semibold leading-[1.42] text-[#426160]">
              <span>{FEATURE_LABELS[row.name as keyof typeof FEATURE_LABELS]}</span>
              <span className="shrink-0 font-black text-[#0f8d8f]">참고값&nbsp; {row.value}</span>
            </div>
          ))}
        </div>

      </section>

      {hasStrongRiskPattern && (
        <section className="rounded-[18px] border border-[#dbecea] bg-white px-4 py-5 shadow-sm shadow-teal-950/5">
          <p className="text-[18px] font-black text-[#183f40]">다음에 무엇을 하면 좋을까요?</p>
          <p className="mt-2 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
            이번 결과는 진단이 아니라 참고 신호입니다. 다만 강한 위험 신호가 보였기 때문에,
            같은 조건의 음성을 한 번 더 분석하고 최근 생활 변화를 함께 살펴보는 것이 좋습니다.
          </p>

          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-3 rounded-[14px] bg-[#f3faf8] px-4 py-3">
              <RefreshCw className="mt-0.5 h-6 w-6 shrink-0 text-[#0f8d8f]" />
              <div>
                <p className="text-[16px] font-black text-[#183f40]">같은 조건으로 다시 확인하기</p>
                <p className="mt-1 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
                  통화 품질, 피로, 주변 소음의 영향을 줄이기 위해 비슷한 길이와 환경의 음성을 한 번 더 분석해 보세요.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-[14px] bg-[#f8fbfb] px-4 py-3">
              <CalendarCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#0f8d8f]" />
              <div>
                <p className="text-[16px] font-black text-[#183f40]">최근 생활 변화 살펴보기</p>
                <p className="mt-1 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
                  말의 흐름, 기억 착오, 익숙한 일 처리 어려움이 반복되는지 가족과 함께 차분히 확인해 주세요.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-[14px] bg-[#fffaf0] px-4 py-3">
              <Stethoscope className="mt-0.5 h-6 w-6 shrink-0 text-[#c27a12]" />
              <div>
                <p className="text-[16px] font-black text-[#183f40]">상담 또는 검사 예약 고려하기</p>
                <p className="mt-1 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
                  변화가 반복되거나 걱정이 지속된다면 치매안심센터, 보건소, 신경과 등 전문 상담을 권장합니다.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {hasMildChangePattern && (
        <section className="rounded-[18px] border border-[#dbecea] bg-white px-4 py-5 shadow-sm shadow-teal-950/5">
          <p className="text-[18px] font-black text-[#183f40]">조금 더 지켜보면 좋은 신호입니다</p>
          <p className="mt-2 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
            이번 결과는 진단이 아니라 참고 신호입니다. 가벼운 변화 가능성 패턴이 보였기 때문에,
            비슷한 조건의 음성을 한 번 더 확인하고 최근 말하기나 기억 관련 변화가 반복되는지 살펴보는 것이 좋습니다.
          </p>

          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-3 rounded-[14px] bg-[#f3faf8] px-4 py-3">
              <RefreshCw className="mt-0.5 h-6 w-6 shrink-0 text-[#0f8d8f]" />
              <div>
                <p className="text-[16px] font-black text-[#183f40]">비슷한 조건으로 다시 확인하기</p>
                <p className="mt-1 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
                  컨디션이나 녹음 품질의 영향을 줄이기 위해 비슷한 환경에서 한 번 더 분석해 보세요.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-[14px] bg-[#f8fbfb] px-4 py-3">
              <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-[#0f8d8f]" />
              <div>
                <p className="text-[16px] font-black text-[#183f40]">작은 변화 기록하기</p>
                <p className="mt-1 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
                  말이 자주 끊기거나 단어를 찾기 어려워하는 일이 반복되는지 짧게 메모해 보세요.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-[14px] bg-[#f8fbfb] px-4 py-3">
              <CalendarCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#0f8d8f]" />
              <div>
                <p className="text-[16px] font-black text-[#183f40]">필요할 때 상담 고려하기</p>
                <p className="mt-1 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
                  변화가 반복되거나 가족이 함께 걱정할 정도라면 전문 상담을 가볍게 고려해 보세요.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
