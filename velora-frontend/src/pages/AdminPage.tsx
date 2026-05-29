import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, Database, GitBranch, ShieldCheck, Server } from 'lucide-react'
import { getAdminDashboard } from '@/lib/api'

interface AdminPageProps {
  onBack: () => void
}

const number = (value: unknown) => Number(value || 0)

export default function AdminPage({ onBack }: AdminPageProps) {
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getAdminDashboard()
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : '관리자 데이터를 불러오지 못했습니다.'))
  }, [])

  if (error) {
    return (
      <div className="flex min-h-[700px] flex-col justify-center text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-3 text-[13px] font-bold text-red-600">{error}</p>
        <button onClick={onBack} className="mt-5 h-12 rounded-full bg-[#0f7d82] text-sm font-black text-white">돌아가기</button>
      </div>
    )
  }

  if (!data) {
    return <div className="flex min-h-[700px] items-center justify-center text-[13px] font-bold text-[#6f8785]">관리자 콘솔 로딩 중...</div>
  }

  const system = data.system || {}
  const pipeline = data.pipeline || {}
  const storage = data.storage || {}
  const alerts = (data.alerts || []) as Array<Record<string, unknown>>
  const nodeRatio = Math.min(1, number(system.active_ai_nodes) / Math.max(1, number(system.max_ai_nodes)))
  const modelLayer = pipeline.model_layer || {}
  const modelClasses = Array.isArray(modelLayer.classes) ? modelLayer.classes.join(' / ') : '-'
  const modelAccuracy = modelLayer.accuracy == null ? '-' : `${Math.round(number(modelLayer.accuracy) * 100)}%`
  const modelRuntime = modelLayer.runtime?.inference_device || '-'

  return (
    <div className="space-y-4 pt-2">
      <section className="rounded-[26px] bg-[#152329] p-4 text-white">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-[#7bd88f]" />
          <p className="text-[15px] font-black">Admin Console</p>
        </div>
        <p className="mt-1 text-[11px] text-white/60">Server & AI Infrastructure Control</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'CPU', value: `${Math.round(number(system.cpu_load_1m) * 100)}%` },
            { label: '처리', value: `${number(system.requests_completed)}` },
            { label: '노드', value: `${number(system.active_ai_nodes)}/${number(system.max_ai_nodes)}` },
          ].map(item => (
            <div key={item.label} className="rounded-2xl bg-white/8 p-3 text-center">
              <p className="text-[10px] text-white/55">{item.label}</p>
              <p className="mt-1 text-[18px] font-black">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] text-white/70">
            <span>활성 AI 서버 노드</span>
            <span>Auto-scaling ON</span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#7bd88f]" style={{ width: `${nodeRatio * 100}%` }} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce9e6] bg-white p-4">
        <p className="flex items-center gap-2 text-[13px] font-black text-[#183f40]">
          <GitBranch className="h-4 w-4 text-[#0f7d82]" />
          AI 모델 및 파이프라인
        </p>
        <div className="mt-3 space-y-2">
          {[
            ['모바일 수집', pipeline.mobile_capture?.status, pipeline.mobile_capture?.queue],
            ['데이터 처리', pipeline.data_processing?.status, pipeline.data_processing?.quality_passed],
            ['특징 엔진', pipeline.feature_engine?.status, pipeline.feature_engine?.feature_vectors],
            ['모델 레이어', modelLayer.status, modelLayer.model_source || '-'],
            ['학습 클래스', modelLayer.status, modelClasses],
            ['검증 정확도', modelLayer.status, modelAccuracy],
            ['학습 Epoch', modelLayer.status, modelLayer.epochs_trained || '-'],
            ['추론 장치', modelLayer.status, modelRuntime],
          ].map(([label, status, meta]) => (
            <div key={String(label)} className="flex items-center justify-between rounded-xl bg-[#f7fbfa] px-3 py-3">
              <span className="text-[12px] font-black text-[#183f40]">{label}</span>
              <span className="text-[11px] font-bold text-[#0f7d82]">{String(status)} · {String(meta)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm shadow-teal-950/5">
          <Database className="h-5 w-5 text-[#0f7d82]" />
          <p className="mt-2 text-[11px] text-[#7d9593]">특징/결과 저장</p>
          <p className="text-[20px] font-black text-[#183f40]">{number(storage.feature_result_count)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm shadow-teal-950/5">
          <ShieldCheck className="h-5 w-5 text-[#0f7d82]" />
          <p className="mt-2 text-[11px] text-[#7d9593]">원본 보관</p>
          <p className="text-[20px] font-black text-[#183f40]">{number(storage.raw_audio_retained_count)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce9e6] bg-white p-4">
        <p className="flex items-center gap-2 text-[13px] font-black text-[#183f40]">
          <Activity className="h-4 w-4 text-[#0f7d82]" />
          최근 시스템 알림
        </p>
        <div className="mt-3 space-y-2">
          {alerts.length === 0 ? (
            <p className="rounded-xl bg-[#f7fbfa] px-3 py-3 text-[12px] font-semibold text-[#6f8785]">운영 알림 없음</p>
          ) : alerts.map((alert, idx) => (
            <p key={idx} className="rounded-xl bg-amber-50 px-3 py-3 text-[12px] font-semibold text-amber-700">{alert.message as string}</p>
          ))}
        </div>
      </section>
    </div>
  )
}
