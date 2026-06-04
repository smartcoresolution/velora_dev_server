import { useEffect, useRef, useState } from 'react'
import { PhoneCall, ShieldCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SignupPage from './pages/SignupPage'
import LoginPage from './pages/LoginPage'
import ServiceMenuPage from './pages/ServiceMenuPage'
import ConsentPage from './pages/ConsentPage'
import UploadPage from './pages/UploadPage'
import SelfVoicePage from './pages/SelfVoicePage'
import AnalyzingPage from './pages/AnalyzingPage'
import ResultsPage from './pages/ResultsPage'
import ReliabilityPage from './pages/ReliabilityPage'
import FollowupPage from './pages/FollowupPage'
import AdminPage from './pages/AdminPage'
import HistoryPage from './pages/HistoryPage'
import AdminLoginPage from './pages/AdminLoginPage'
import RecordingGuidePage from './pages/RecordingGuidePage'
import { loginAccount, signupAccount } from './lib/api'

export type AppStep =
  | 'home'
  | 'signup'
  | 'login'
  | 'service'
  | 'consent'
  | 'upload'
  | 'selfVoice'
  | 'analyzing'
  | 'results'
  | 'reliability'
  | 'followup'
  | 'history'
  | 'recordingGuide'
  | 'adminLogin'
  | 'admin'

export type VerificationType = 'parent_call' | 'self_voice'

export interface AppState {
  consentToken: string
  email: string
  ageGroup: string
  fileId: string
  voiceSampleId: string
  voiceSampleDurationSeconds: number
  verificationType: VerificationType
  analysisId: string
  analysisResult: Record<string, unknown> | null
  resultsData: Record<string, unknown> | null
  loginPassword: string
  loginError: string
  signupPassword: string
  signupPasswordConfirm: string
  signupError: string
  adminId: string
  adminPassword: string
  adminError: string
}

const initialState: AppState = {
  consentToken: '',
  email: '',
  ageGroup: '',
  fileId: '',
  voiceSampleId: '',
  voiceSampleDurationSeconds: 0,
  verificationType: 'parent_call',
  analysisId: '',
  analysisResult: null,
  resultsData: null,
  loginPassword: '',
  loginError: '',
  signupPassword: '',
  signupPasswordConfirm: '',
  signupError: '',
  adminId: '',
  adminPassword: '',
  adminError: '',
}

const appSessionKey = 'velora_app_session'

interface PersistedAppSession {
  step: AppStep
  historyBackStep: AppStep
  resultsBackStep: AppStep
  consentBackStep: AppStep
  state: Partial<AppState>
}

const loadAppSession = (): PersistedAppSession | null => {
  try {
    return JSON.parse(sessionStorage.getItem(appSessionKey) || 'null') as PersistedAppSession | null
  } catch {
    return null
  }
}

const persistableState = (state: AppState): Partial<AppState> => ({
  consentToken: state.consentToken,
  email: state.email,
  ageGroup: state.ageGroup,
  fileId: state.fileId,
  voiceSampleId: state.voiceSampleId,
  voiceSampleDurationSeconds: state.voiceSampleDurationSeconds,
  verificationType: state.verificationType,
  analysisId: state.analysisId,
  analysisResult: state.analysisResult,
  resultsData: state.resultsData,
})

const historyKeyFor = (email: string) => `velora_history:${email.trim().toLowerCase()}`

const historySignature = (item: Record<string, any>) => {
  const analysis = item.analysis as Record<string, any> | undefined
  const verificationType = item.verification_type || 'parent_call'
  const savedAt = item.saved_at || item.created_at || analysis?.created_at || ''
  const date = new Date(String(savedAt))
  const minute = Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16)
  const confidence = Math.round(Number(analysis?.confidence_score || 0) * 100)
  const probabilities = analysis?.model_probabilities || {}
  const normal = Math.round(Number(probabilities.Normal || 0) * 100)
  const mci = Math.round(Number(probabilities.MCI || 0) * 100)
  const ad = Math.round(Number(probabilities.AD || 0) * 100)
  return `${verificationType}:${minute}:${confidence}:${normal}:${mci}:${ad}`
}

const normalizeHistory = (items: Array<Record<string, any>>) => {
  const seenIds = new Set<string>()
  const seenSignatures = new Set<string>()
  return items.filter(item => {
    const analysis = item.analysis as Record<string, unknown> | undefined
    const analysisId = String(analysis?.analysis_id || '')
    const modelSource = String(analysis?.model_source || '').toLowerCase()
    const signature = historySignature(item)
    if (analysisId.startsWith('demo-analysis-') || modelSource === 'demo') return false
    if (!analysisId || seenIds.has(analysisId) || seenSignatures.has(signature)) return false
    seenIds.add(analysisId)
    seenSignatures.add(signature)
    return true
  })
}

const loadHistoryFor = (email: string) => {
  if (!email.trim()) return []
  try {
    const key = historyKeyFor(email)
    const rawHistory = JSON.parse(localStorage.getItem(key) || '[]') as Array<Record<string, any>>
    const deduped = normalizeHistory(rawHistory)
    if (deduped.length !== rawHistory.length) {
      localStorage.setItem(key, JSON.stringify(deduped))
    }
    return deduped
  } catch {
    return []
  }
}

function App() {
  const restoredSession = loadAppSession()
  const initialStep: AppStep = window.location.pathname === '/admin' ? 'adminLogin' : restoredSession?.step || 'home'
  const [step, setStep] = useState<AppStep>(initialStep)
  const [historyBackStep, setHistoryBackStep] = useState<AppStep>(restoredSession?.historyBackStep || 'login')
  const [resultsBackStep, setResultsBackStep] = useState<AppStep>(restoredSession?.resultsBackStep || 'upload')
  const [consentBackStep, setConsentBackStep] = useState<AppStep>(restoredSession?.consentBackStep || 'signup')
  const [, setIsMember] = useState(() => localStorage.getItem('velora_member_ready') === 'true')
  const [history, setHistory] = useState<Array<Record<string, any>>>([])
  const [state, setState] = useState<AppState>({ ...initialState, ...(restoredSession?.state || {}) })
  const browserHistoryReadyRef = useRef(false)
  const initialBrowserStepRef = useRef<AppStep>(initialStep)

  useEffect(() => {
    const url = window.location.href
    const initialBrowserStep = initialBrowserStepRef.current
    const baseStep: AppStep = 'home'
    window.history.replaceState({ veloraApp: true, step: baseStep }, '', url)
    if (initialBrowserStep !== baseStep) {
      window.history.pushState({ veloraApp: true, step: initialBrowserStep }, '', url)
    }
    browserHistoryReadyRef.current = true

    const handlePopState = (event: PopStateEvent) => {
      const nextStep = event.state?.veloraApp ? event.state.step as AppStep : 'home'
      if (nextStep) setStep(nextStep)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!browserHistoryReadyRef.current) return
    const currentState = window.history.state as { veloraApp?: boolean; step?: AppStep } | null
    if (currentState?.veloraApp && currentState.step === step) return
    window.history.pushState({ veloraApp: true, step }, '', window.location.href)
  }, [step])

  useEffect(() => {
    try {
      sessionStorage.setItem(appSessionKey, JSON.stringify({
        step,
        historyBackStep,
        resultsBackStep,
        consentBackStep,
        state: persistableState(state),
      }))
    } catch {
      // Session persistence is best-effort only.
    }
  }, [consentBackStep, historyBackStep, resultsBackStep, state, step])

  const updateState = (partial: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }

  const saveHistory = (resultsData: Record<string, unknown>) => {
    const historyKey = historyKeyFor(state.email)
    setHistory(prev => {
      const nextItem: Record<string, any> = { ...(resultsData as Record<string, any>), saved_at: new Date().toISOString() }
      const nextAnalysis = nextItem.analysis as Record<string, unknown> | undefined
      const nextAnalysisId = String(nextAnalysis?.analysis_id || '')
      const nextSignature = historySignature(nextItem)
      const withoutDuplicate = prev.filter(item => {
        const itemAnalysis = item.analysis as Record<string, unknown> | undefined
        return String(itemAnalysis?.analysis_id || '') !== nextAnalysisId && historySignature(item) !== nextSignature
      })
      const next = [nextItem, ...withoutDuplicate].slice(0, 10)
      localStorage.setItem(historyKey, JSON.stringify(next))
      return next
    })
  }

  const deleteHistoryItem = (analysisId: string) => {
    const historyKey = historyKeyFor(state.email)
    setHistory(prev => {
      const next = prev.filter(item => String(item.analysis?.analysis_id || '') !== analysisId)
      localStorage.setItem(historyKey, JSON.stringify(next))
      return next
    })
    const currentAnalysis = state.resultsData?.analysis as Record<string, unknown> | undefined
    if (String(currentAnalysis?.analysis_id || '') === analysisId) {
      updateState({
        analysisId: '',
        analysisResult: null,
        resultsData: null,
      })
    }
  }

  const resetCurrentAnalysis = (verificationType: VerificationType = 'parent_call') => {
    updateState({
      verificationType,
      fileId: '',
      voiceSampleId: '',
      voiceSampleDurationSeconds: 0,
      analysisId: '',
      analysisResult: null,
      resultsData: null,
    })
    if (state.consentToken) {
      setStep(verificationType === 'self_voice' ? 'selfVoice' : 'upload')
      return
    }
    setConsentBackStep('service')
    setStep('consent')
  }

  const handleSignupComplete = async () => {
    if (!state.email.trim()) {
      updateState({ signupError: '이메일을 입력해 주세요.' })
      return
    }
    if (state.signupPassword.length < 4) {
      updateState({ signupError: '비밀번호를 4자 이상 입력해 주세요.' })
      return
    }
    if (state.signupPassword !== state.signupPasswordConfirm) {
      updateState({ signupError: '비밀번호 확인이 일치하지 않습니다.' })
      return
    }
    try {
      const account = await signupAccount({
        email: state.email.trim(),
        password: state.signupPassword,
        age_group: state.ageGroup || 'other',
      })
      localStorage.setItem('velora_member_ready', 'true')
      setIsMember(true)
      setHistory(loadHistoryFor(account.email || state.email))
      updateState({
        email: account.email || state.email.trim(),
        ageGroup: account.age_group || state.ageGroup || 'other',
        signupPassword: '',
        signupPasswordConfirm: '',
        signupError: '',
      })
      setStep('service')
    } catch (error) {
      updateState({ signupError: error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.' })
    }
  }

  const handleLogin = async () => {
    if (!state.email.trim() || !state.loginPassword.trim()) {
      updateState({ loginError: '이메일과 비밀번호를 입력해 주세요.' })
      return
    }
    try {
      const account = await loginAccount({
        email: state.email.trim(),
        password: state.loginPassword,
      })
      localStorage.setItem('velora_member_ready', 'true')
      setIsMember(true)
      setHistory(loadHistoryFor(account.email || state.email))
      updateState({
        email: account.email || state.email.trim(),
        ageGroup: account.age_group || state.ageGroup || 'other',
        loginPassword: '',
        loginError: '',
      })
      setStep('service')
    } catch (error) {
      updateState({ loginError: error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.' })
    }
  }

  const handleAdminLogin = () => {
    if (state.adminId === 'admin' && state.adminPassword === 'admin') {
      updateState({ adminPassword: '', adminError: '' })
      setStep('admin')
      return
    }
    updateState({ adminError: '관리자 ID 또는 비밀번호를 확인해 주세요.' })
  }

  const goBack = () => {
    if (step === 'signup') setStep('home')
    if (step === 'login') setStep('home')
    if (step === 'service') setStep('login')
    if (step === 'consent') setStep(consentBackStep)
    if (step === 'upload') setStep('service')
    if (step === 'selfVoice') setStep('service')
    if (step === 'analyzing') setStep(state.verificationType === 'self_voice' ? 'selfVoice' : 'upload')
    if (step === 'results') setStep(resultsBackStep)
    if (step === 'reliability') setStep('results')
    if (step === 'followup') setStep('results')
    if (step === 'history') setStep(historyBackStep)
    if (step === 'recordingGuide') setStep('service')
    if (step === 'adminLogin') setStep('home')
    if (step === 'admin') setStep('home')
  }

  const goHome = () => {
    setStep('home')
  }

  const screenTitle = {
    home: '',
    signup: '회원 가입',
    login: '로그인',
    service: '서비스 시작',
    consent: '동의 절차',
    upload: '부모통화검증',
    selfVoice: '내 목소리 검증',
    analyzing: '통화 음성 분석',
    results: '분석 결과',
    reliability: '결과 자세히보기',
    followup: '후속 대응 안내',
    history: '지난 검증 이력',
    recordingGuide: '통화 녹음 가이드',
    adminLogin: '관리자 로그인',
    admin: '관리자 콘솔',
  }[step]

  return (
    <div className="min-h-screen bg-[#eef5f2] px-3 py-4 text-[#143c3d] sm:py-8">
      <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[34px] border border-black/10 bg-[#fbfdfb] shadow-2xl shadow-teal-950/10">
        {step !== 'home' && (
          <header className="flex items-center justify-between px-5 pb-2 pt-5">
            <button
              onClick={goBack}
              className="flex h-11 w-14 items-center justify-start rounded-full text-[24px] font-black text-[#0b7074] hover:bg-[#e8f3f1]"
              aria-label="이전"
            >
              ←
            </button>
            <h1 className={`${step === 'login' || step === 'selfVoice' || step === 'service' || step === 'consent' || step === 'upload' || step === 'analyzing' || step === 'results' || step === 'reliability' || step === 'recordingGuide' ? 'text-[24px] font-black' : 'text-[17px] font-bold'} text-[#173c3d]`}>
              {screenTitle}
            </h1>
            <button
              onClick={goHome}
              className="flex h-11 w-16 items-center justify-end rounded-full text-[17px] font-black text-[#0b7074] hover:bg-[#e8f3f1]"
              aria-label="처음으로"
            >
              처음
            </button>
          </header>
        )}

        <main className="min-h-[760px] px-5 pb-6">
          {step === 'home' && (
            <section className="flex min-h-[760px] flex-col">
              <div className="flex justify-end pt-5">
                <Button
                  variant="outline"
                  className="h-12 rounded-full border-[#d7e6e2] bg-white px-5 text-[16px] font-black text-[#0f6f73] shadow-none hover:bg-[#f4faf8]"
                  onClick={() => setStep('signup')}
                >
                  <UserPlus className="mr-2 h-5 w-5" />
                  회원가입
                </Button>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <p className="text-[42px] font-black tracking-tight text-[#0c7478]">VELORA</p>
                <p className="mt-2 text-[18px] font-black text-[#255a5b]">목소리 속 인지 변화 참고 신호</p>

                <div className="mt-12 flex h-36 w-36 items-center justify-center rounded-full bg-[#d7efea]">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#15908e] shadow-lg shadow-teal-800/20">
                    <PhoneCall className="h-16 w-16 text-white" />
                  </div>
                </div>

                <p className="mt-10 whitespace-pre-line text-[18px] font-bold leading-[1.55] text-[#255a5b]">
                  부모님과의 통화 또는 내 목소리에서{'\n'}인지기능 변화와 관련된{'\n'}참고 신호를 살펴봅니다.
                </p>
              </div>

              <div className="space-y-3 pb-4">
                <Button
                  className="h-16 w-full rounded-full bg-[#0f7d82] text-[18px] font-black text-white shadow-none hover:bg-[#0b6f74]"
                  onClick={() => setStep('login')}
                >
                  서비스 시작
                </Button>
                <p className="flex items-center justify-center gap-1 pt-5 text-[14px] font-semibold leading-[1.42] text-[#7c9694]">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  의료 진단이 아닌 비의료적 참고 정보입니다
                </p>
              </div>
            </section>
          )}

          {step === 'signup' && (
            <SignupPage
              email={state.email}
              password={state.signupPassword}
              passwordConfirm={state.signupPasswordConfirm}
              error={state.signupError}
              onChange={updateState}
              onComplete={handleSignupComplete}
            />
          )}

          {step === 'login' && (
            <LoginPage
              email={state.email}
              password={state.loginPassword}
              error={state.loginError}
              onChange={updateState}
              onSubmit={handleLogin}
            />
          )}

          {step === 'service' && (
            <ServiceMenuPage
              onParentCall={() => resetCurrentAnalysis('parent_call')}
              onSelfVoice={() => resetCurrentAnalysis('self_voice')}
              onHistory={() => {
                setHistoryBackStep('service')
                setStep('history')
              }}
              onRecordingGuide={() => setStep('recordingGuide')}
            />
          )}

          {step === 'recordingGuide' && <RecordingGuidePage />}

          {step === 'consent' && (
            <ConsentPage
              ageGroup={state.ageGroup}
              onComplete={(token, ageGroup) => {
                updateState({ consentToken: token, ageGroup })
                setStep(state.verificationType === 'self_voice' ? 'selfVoice' : 'upload')
              }}
            />
          )}

          {step === 'history' && (
            <HistoryPage
              items={history}
              onSelect={item => {
                updateState({
                  verificationType: item.verification_type === 'self_voice' ? 'self_voice' : 'parent_call',
                  analysisId: String(item.analysis?.analysis_id || ''),
                  analysisResult: item.analysis || null,
                  resultsData: item,
                })
                setResultsBackStep('history')
                setStep('results')
              }}
              onRestart={() => setStep('service')}
              onDelete={deleteHistoryItem}
            />
          )}

          {step === 'upload' && (
            <UploadPage
              consentToken={state.consentToken}
              onComplete={(fileId, voiceSampleId, voiceSampleDurationSeconds) => {
                updateState({ fileId, voiceSampleId, voiceSampleDurationSeconds })
                setStep('analyzing')
              }}
              onBack={() => setStep('service')}
            />
          )}

          {step === 'selfVoice' && (
            <SelfVoicePage
              consentToken={state.consentToken}
              onComplete={(fileId, durationSeconds) => {
                updateState({
                  fileId,
                  voiceSampleId: '',
                  voiceSampleDurationSeconds: durationSeconds,
                  verificationType: 'self_voice',
                })
                setStep('analyzing')
              }}
              onBack={() => setStep('service')}
            />
          )}

          {step === 'analyzing' && (
            <AnalyzingPage
              fileId={state.fileId}
              voiceSampleId={state.voiceSampleId}
              verificationType={state.verificationType}
              onComplete={(analysisId, analysisResult, resultsData) => {
                const enrichedResultsData = {
                  ...resultsData,
                  verification_type: state.verificationType,
                  voice_sample: {
                    ...((resultsData.voice_sample as Record<string, unknown> | undefined) || {}),
                    duration_seconds: state.voiceSampleDurationSeconds,
                  },
                }
                updateState({ analysisId, analysisResult, resultsData: enrichedResultsData })
                saveHistory(enrichedResultsData)
                setResultsBackStep(state.verificationType === 'self_voice' ? 'selfVoice' : 'upload')
                setStep('results')
              }}
              onBack={() => setStep(state.verificationType === 'self_voice' ? 'selfVoice' : 'upload')}
            />
          )}

          {step === 'results' && (
            <ResultsPage
              resultsData={state.resultsData}
              onRestart={() => resetCurrentAnalysis(state.verificationType)}
              onReliability={() => setStep('reliability')}
            />
          )}

          {step === 'reliability' && <ReliabilityPage resultsData={state.resultsData} />}

          {step === 'followup' && (
            <FollowupPage
              resultsData={state.resultsData}
              onNewAnalysis={resetCurrentAnalysis}
              onHistory={() => {
                setHistoryBackStep('followup')
                setStep('history')
              }}
            />
          )}

          {step === 'adminLogin' && (
            <AdminLoginPage
              adminId={state.adminId}
              adminPassword={state.adminPassword}
              error={state.adminError}
              onChange={updateState}
              onSubmit={handleAdminLogin}
              onBack={() => setStep('home')}
            />
          )}

          {step === 'admin' && <AdminPage onBack={() => setStep('home')} />}
        </main>

        <div className="flex justify-center pb-3">
          <div className="h-1.5 w-28 rounded-full bg-black/80" />
        </div>
      </div>
    </div>
  )
}

export default App
