import { Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LoginPageProps {
  email: string
  password: string
  error: string
  onChange: (partial: { email?: string; loginPassword?: string; loginError?: string }) => void
  onSubmit: () => void
}

export default function LoginPage({ email, password, error, onChange, onSubmit }: LoginPageProps) {
  const inputClass = "h-[52px] w-full rounded-xl border border-[#e3ece9] bg-white px-11 text-[14px] font-medium text-[#183f40] shadow-sm shadow-teal-950/5 outline-none transition focus:border-[#0f7d82] focus:ring-2 focus:ring-[#d7efea]"

  return (
    <div className="flex min-h-[700px] flex-col justify-center pt-2">
      <section className="rounded-[28px] border border-[#dce9e6] bg-white p-5 shadow-sm shadow-teal-950/5">
        <p className="text-center text-[20px] font-black text-[#183f40]">로그인</p>
        <p className="mt-2 text-center text-[12px] leading-5 text-[#7d9593]">
          기존 가입자는 로그인 후 새 검증과 지난 검증 이력을 선택할 수 있습니다.
        </p>

        <div className="mt-6 space-y-3">
          <label className="relative block">
            <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
            <input
              type="email"
              value={email}
              onChange={event => onChange({ email: event.target.value, loginError: '' })}
              className={inputClass}
              placeholder="이메일"
            />
          </label>
          <label className="relative block">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
            <input
              type="password"
              value={password}
              onChange={event => onChange({ loginPassword: event.target.value, loginError: '' })}
              className={inputClass}
              placeholder="비밀번호"
            />
          </label>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-600">{error}</p>}

        <Button
          onClick={onSubmit}
          className="mt-5 h-12 w-full rounded-full bg-[#0f7d82] text-[14px] font-black text-white shadow-none hover:bg-[#0b6f74]"
        >
          로그인
        </Button>
      </section>
    </div>
  )
}
