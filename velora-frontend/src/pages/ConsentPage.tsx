import { useEffect, useState } from 'react'
import { AlertCircle, Check, ChevronRight, Lock, Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { fetchPolicy, submitConsent } from '@/lib/api'

interface ConsentPageProps {
  onComplete: (token: string, ageGroup: string, userName: string) => void
}

interface ConsentItem {
  key: string
  label: string
  required: boolean
}

export default function ConsentPage({ onComplete }: ConsentPageProps) {
  const [items, setItems] = useState<ConsentItem[]>([])
  const [ageGroup, setAgeGroup] = useState('')
  const [userName, setUserName] = useState('')
  const [email, setEmail] = useState('')
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPolicy()
      .then(data => {
        setItems(data.consent_items)
        const initial: Record<string, boolean> = {}
        data.consent_items.forEach((item: ConsentItem) => {
          initial[item.key] = false
        })
        setChecks(initial)
      })
      .catch(() => setError('정책 정보를 불러오지 못했습니다.'))
  }, [])

  const allChecked = items.length > 0 && items.every(item => checks[item.key])

  const toggleAll = () => {
    const nextValue = !allChecked
    const next: Record<string, boolean> = {}
    items.forEach(item => {
      next[item.key] = nextValue
    })
    setChecks(next)
  }

  const handleSubmit = async () => {
    const normalizedName = userName.trim()
    if (!normalizedName) {
      setError('이름을 입력해 주세요.')
      return
    }
    if (!email.trim()) {
      setError('이메일을 입력해 주세요.')
      return
    }
    if (!ageGroup) {
      setError('연령대를 선택해 주세요.')
      return
    }
    if (!allChecked) {
      setError('필수 동의 항목을 확인해 주세요.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await submitConsent({
        user_name: normalizedName,
        age_group: ageGroup,
        data_collection_agreed: checks.data_collection ?? false,
        privacy_policy_agreed: checks.privacy_policy ?? false,
        non_medical_disclaimer_agreed: checks.non_medical_disclaimer ?? false,
        third_party_voice_agreed: checks.third_party_voice ?? false,
      })
      onComplete(result.consent_token, ageGroup, normalizedName)
    } catch (e) {
      setError(e instanceof Error ? e.message : '동의 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "h-[52px] w-full rounded-xl border border-[#e3ece9] bg-white px-11 text-[14px] font-medium text-[#183f40] shadow-sm shadow-teal-950/5 outline-none transition focus:border-[#0f7d82] focus:ring-2 focus:ring-[#d7efea]"

  return (
    <div className="space-y-5 pt-2">
      <section className="space-y-3">
        <label className="relative block">
          <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
          <input
            value={userName}
            onChange={e => {
              setUserName(e.target.value)
              setError('')
            }}
            className={inputClass}
            placeholder="이름"
          />
        </label>
        <label className="relative block">
          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
          <input
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              setError('')
            }}
            className={inputClass}
            placeholder="이메일"
          />
        </label>
        <label className="relative block">
          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
          <input className={inputClass} type="password" placeholder="비밀번호" />
        </label>
        <label className="relative block">
          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
          <input className={inputClass} type="password" placeholder="비밀번호 확인" />
        </label>
      </section>

      <section>
        <p className="mb-2 text-[13px] font-bold text-[#305b5c]">연령대</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: '40s', label: '40대' },
            { value: '50s', label: '50대' },
            { value: 'other', label: '기타' },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => {
                setAgeGroup(option.value)
                setError('')
              }}
              className={`h-11 rounded-xl border text-sm font-bold transition ${
                ageGroup === option.value
                  ? 'border-[#0f7d82] bg-[#e5f5f1] text-[#0b7074]'
                  : 'border-[#e3ece9] bg-white text-[#77908f]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce9e6] bg-[#f7fbfa] p-4">
        <div className="mb-3 flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7d82]" />
          <div>
            <p className="text-[13px] font-bold text-[#183f40]">안내</p>
            <p className="mt-1 text-[12px] leading-5 text-[#67807f]">
              VELORA는 사용자의 데이터를 안전하게 보호하고 신뢰할 수 있는 서비스를 제공하기 위해 아래 사항에 동의가 필요합니다.
            </p>
          </div>
        </div>
        <button
          onClick={toggleAll}
          className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-3 text-left text-[13px] font-bold text-[#183f40]"
        >
          <span className="flex items-center gap-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded-md ${allChecked ? 'bg-[#0f7d82]' : 'bg-[#e9f1ef]'}`}>
              {allChecked && <Check className="h-3.5 w-3.5 text-white" />}
            </span>
            필수 항목
          </span>
          <ChevronRight className="h-4 w-4 text-[#90a5a3]" />
        </button>

        <div className="mt-3 space-y-3">
          {items.map(item => (
            <label key={item.key} className="flex items-start gap-3 rounded-xl bg-white px-3 py-3">
              <Checkbox
                checked={checks[item.key] ?? false}
                onCheckedChange={checked => setChecks(prev => ({ ...prev, [item.key]: checked === true }))}
                className="mt-0.5 border-[#b9cbc8] data-[state=checked]:bg-[#0f7d82]"
              />
              <span className="text-[12px] font-medium leading-5 text-[#426160]">{item.label}</span>
            </label>
          ))}
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-600">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={loading || !allChecked}
        className="h-14 w-full rounded-full bg-[#0f7d82] text-[15px] font-bold text-white shadow-none hover:bg-[#0b6f74]"
      >
        {loading ? '처리 중...' : '동의하고 계속'}
      </Button>

      <p className="flex items-center justify-center gap-1 pt-1 text-[11px] text-[#8aa09e]">
        <Lock className="h-3.5 w-3.5" />
        안전하게 보호되는 정보입니다.
      </p>
    </div>
  )
}
