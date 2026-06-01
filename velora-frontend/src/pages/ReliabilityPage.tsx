import { Activity, CheckCircle, PhoneCall, ShieldCheck, UserRoundMinus } from 'lucide-react'

interface ReliabilityPageProps {
  resultsData: Record<string, unknown> | null
}

const PROBABILITY_LABELS = {
  Normal: { label: '인지기능 위험 낮음', color: '#16a36a' },
  MCI: { label: '인지기능 변화 가능성 있음', color: '#f6a51a' },
  AD: { label: '치매 관련 위험 신호 높음', color: '#ef4444' },
}

export default function ReliabilityPage({ resultsData }: ReliabilityPageProps) {
  const analysis = resultsData?.analysis as Record<string, unknown> | undefined
  const voiceSample = resultsData?.voice_sample as Record<string, unknown> | undefined
  const probabilities = analysis?.model_probabilities as Record<string, number> | undefined
  const features = analysis?.features as Record<string, any> | undefined
  const speechStats = features?.speech_statistics as Record<string, number> | undefined
  const confidenceBreakdown = analysis?.confidence_breakdown as Record<string, number> | undefined
  const confidenceScore = Number(analysis?.confidence_score || 0)
  const parentSpeechSeconds = Number(speechStats?.total_speech_duration || 0)
  const audioQualityScore = Number(confidenceBreakdown?.audio_quality_score ?? confidenceScore)

  const toQualityLabel = (score: number) => {
    if (score >= 0.75) return '양호'
    if (score >= 0.5) return '보통'
    return '미흡'
  }

  const parentSpeechLabel = parentSpeechSeconds > 0 ? `${parentSpeechSeconds.toFixed(1)}초` : '확인 필요'
  const voiceSampleSeconds = Number(voiceSample?.duration_seconds || 0)
  const voiceSampleLabel = voiceSampleSeconds > 0 ? `${voiceSampleSeconds.toFixed(1)}초` : '20초 이상 권장'
  const callQualityLabel = toQualityLabel(audioQualityScore)
  const reliabilityLabel = toQualityLabel(confidenceScore)
  const parentSpeechStatus = parentSpeechSeconds >= 30 ? '양호' : parentSpeechSeconds > 0 ? '보통' : '미흡'
  const probabilityRows = [
    { name: 'Normal', value: Math.round(Number(probabilities?.Normal || 0) * 100), ...PROBABILITY_LABELS.Normal },
    { name: 'MCI', value: Math.round(Number(probabilities?.MCI || 0) * 100), ...PROBABILITY_LABELS.MCI },
    { name: 'AD', value: Math.round(Number(probabilities?.AD || 0) * 100), ...PROBABILITY_LABELS.AD },
  ]
  const topPattern = probabilityRows.reduce((top, row) => (row.value > top.value ? row : top), probabilityRows[0])
  const auxiliarySignals = probabilityRows.filter(row => row.name !== topPattern.name && row.value > 0)

  return (
    <div className="space-y-5 pt-2">
      <section className="rounded-[30px] bg-white px-5 py-7 text-center shadow-sm shadow-teal-950/5">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#d7efea] text-[#0f7d82]">
          <Activity className="h-10 w-10" />
        </div>
        <p className="mt-5 text-[21px] font-black text-[#183f40]">결과 신뢰도</p>
        <p className="mt-2 text-[12px] leading-5 text-[#607b79]">
          부모 발화량, 자녀 음성 기준, 통화 품질을 기준으로 이번 결과를 얼마나 참고할 수 있는지 보여줍니다.
        </p>
      </section>

      <section className="rounded-2xl border border-[#e3ece9] bg-white p-4">
        <p className="text-[13px] font-black text-[#183f40]">모델 참고 결과</p>
        <p className="mt-2 text-[12px] leading-5 text-[#607b79]">
          아래 숫자는 진단 확률이 아니라, 이번 통화 음성이 학습된 음성 패턴 중 어디에 더 가까운지를 보여주는 참고값입니다.
        </p>
        <div className="mt-4 rounded-2xl bg-[#f1f8f6] p-4">
          <p className="text-[11px] font-bold text-[#7d9593]">가장 가까운 패턴</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[15px] font-black text-[#183f40]">{topPattern.label}</p>
            <p className="text-[18px] font-black text-[#0f7d82]">{topPattern.value}%</p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-[#fbfdfb] p-4">
          <p className="text-[11px] font-bold text-[#7d9593]">보조 신호</p>
          <div className="mt-2 space-y-2">
            {auxiliarySignals.map(row => (
              <div key={row.name} className="flex items-center justify-between gap-3 text-[12px] leading-5 text-[#426160]">
                <span>{row.label} 일부 관찰</span>
                <span className="font-bold text-[#607b79]">{row.value}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-[#eef7fb] p-4 text-[12px] leading-5 text-[#426160]">
          가장 높은 값은 이번 통화에서 가장 가깝게 보인 패턴입니다. 보조 신호는 일부 특징이 함께 보였다는 뜻이며,
          이것만으로 인지 저하나 치매를 판단하지 않습니다.
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border border-[#e3ece9] bg-white p-4">
          <PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-[#0f7d82]" />
          <div>
            <p className="text-[13px] font-black text-[#183f40]">부모 발화량: {parentSpeechStatus}</p>
            <p className="mt-1 text-[12px] leading-5 text-[#607b79]">
              이번 분석에 사용된 부모님 발화량은 {parentSpeechLabel}입니다. 부모님 음성이 30초 이상 포함되면 결과를 더 안정적으로 참고할 수 있습니다.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-[#e3ece9] bg-white p-4">
          <UserRoundMinus className="mt-0.5 h-5 w-5 shrink-0 text-[#0f7d82]" />
          <div>
            <p className="text-[13px] font-black text-[#183f40]">자녀 음성 기준: {voiceSampleLabel}</p>
            <p className="mt-1 text-[12px] leading-5 text-[#607b79]">
              등록한 자녀 음성은 통화 속 자녀 목소리를 구분하는 기준으로 사용됩니다.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-[#e3ece9] bg-white p-4">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#0f7d82]" />
          <div>
            <p className="text-[13px] font-black text-[#183f40]">통화 품질: {callQualityLabel}</p>
            <p className="mt-1 text-[12px] leading-5 text-[#607b79]">
              주변 소음이 적고 부모님 목소리가 분명할수록 결과 신뢰도가 높아집니다. 이번 결과 신뢰도는 {reliabilityLabel}입니다.
            </p>
          </div>
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-[#f7fbfa] px-4 py-3 text-[11px] leading-5 text-[#7d9593]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7d82]" />
        신뢰도가 낮거나 보통이면 비슷한 조건의 통화를 다시 업로드해 변화 추세를 함께 확인해 주세요.
      </p>
    </div>
  )
}
