import { Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SignupPageProps {
  email: string
  password: string
  passwordConfirm: string
  error: string
  onChange: (partial: { email?: string; signupPassword?: string; signupPasswordConfirm?: string; signupError?: string }) => void
  onComplete: () => void
}

export default function SignupPage({ email, password, passwordConfirm, error, onChange, onComplete }: SignupPageProps) {
  const canContinue = Boolean(email.trim() && password && passwordConfirm)
  const inputClass = "h-[52px] w-full rounded-xl border border-[#e3ece9] bg-white px-11 text-[14px] font-medium text-[#183f40] shadow-sm shadow-teal-950/5 outline-none transition focus:border-[#0f7d82] focus:ring-2 focus:ring-[#d7efea]"
  const maskedInputClass = `${inputClass} [-webkit-text-security:disc]`

  return (
    <div className="space-y-5 pt-2">
      <section className="space-y-3">
        <label className="relative block">
          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
          <input
            type="email"
            autoComplete="off"
            name="velora-signup-email"
            value={email}
            onChange={event => onChange({ email: event.target.value, signupError: '' })}
            className={inputClass}
            placeholder="이메일"
          />
        </label>
        <label className="relative block">
          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
          <input
            value={password}
            onChange={event => onChange({ signupPassword: event.target.value, signupError: '' })}
            className={maskedInputClass}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            name="velora-signup-code"
            placeholder="비밀번호"
          />
        </label>
        <label className="relative block">
          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
          <input
            value={passwordConfirm}
            onChange={event => onChange({ signupPasswordConfirm: event.target.value, signupError: '' })}
            className={maskedInputClass}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            name="velora-signup-code-confirm"
            placeholder="비밀번호 확인"
          />
        </label>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-600">{error}</p>}

      <Button
        onClick={onComplete}
        disabled={!canContinue}
        className="h-14 w-full rounded-full bg-[#0f7d82] text-[15px] font-bold text-white shadow-none hover:bg-[#0b6f74]"
      >
        서비스 확인으로 이동
      </Button>
    </div>
  )
}
