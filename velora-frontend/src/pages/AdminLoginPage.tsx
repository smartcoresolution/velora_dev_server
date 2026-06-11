import { Lock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AdminLoginPageProps {
  adminId: string
  adminPassword: string
  error: string
  onChange: (partial: { adminId?: string; adminPassword?: string; adminError?: string }) => void
  onSubmit: () => void
  onBack: () => void
}

export default function AdminLoginPage({ adminId, adminPassword, error, onChange, onSubmit, onBack }: AdminLoginPageProps) {
  const inputClass = "h-[52px] w-full rounded-xl border border-[#e3ece9] bg-white px-11 text-[14px] font-medium text-[#183f40] shadow-sm shadow-teal-950/5 outline-none transition focus:border-[#0f7d82] focus:ring-2 focus:ring-[#d7efea]"
  const maskedInputClass = `${inputClass} [-webkit-text-security:disc]`

  return (
    <div className="flex min-h-[700px] flex-col justify-center pt-2">
      <section className="rounded-[28px] border border-[#dce9e6] bg-white p-5 shadow-sm shadow-teal-950/5">
        <p className="text-center text-[20px] font-black text-[#183f40]">관리자 로그인</p>
        <p className="mt-2 text-center text-[12px] leading-5 text-[#7d9593]">
          운영자 전용 페이지입니다.
        </p>

        <div className="mt-6 space-y-3">
          <label className="relative block">
            <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
            <input
              autoComplete="off"
              name="velora-admin-id"
              value={adminId}
              onChange={event => onChange({ adminId: event.target.value, adminError: '' })}
              className={inputClass}
              placeholder="ID"
            />
          </label>
          <label className="relative block">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0f7d82]" />
            <input
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name="velora-admin-code"
              value={adminPassword}
              onChange={event => onChange({ adminPassword: event.target.value, adminError: '' })}
              className={maskedInputClass}
              placeholder="Password"
            />
          </label>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-600">{error}</p>}

        <Button
          onClick={onSubmit}
          className="mt-5 h-12 w-full rounded-full bg-[#0f7d82] text-[14px] font-black text-white shadow-none hover:bg-[#0b6f74]"
        >
          관리자 콘솔 입장
        </Button>
        <Button
          onClick={onBack}
          variant="outline"
          className="mt-3 h-12 w-full rounded-full border-[#dce9e6] bg-white text-[14px] font-black text-[#0f7d82] shadow-none hover:bg-[#f4faf8]"
        >
          홈으로
        </Button>
      </section>
    </div>
  )
}
