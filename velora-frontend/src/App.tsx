import { useState } from 'react'
import { Bell, History, Mic, Settings, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ConsentPage from './pages/ConsentPage'
import UploadPage from './pages/UploadPage'
import AnalyzingPage from './pages/AnalyzingPage'
import ResultsPage from './pages/ResultsPage'
import AdminPage from './pages/AdminPage'
import HistoryPage from './pages/HistoryPage'

export type AppStep = 'home' | 'consent' | 'upload' | 'analyzing' | 'results' | 'history' | 'admin'

export interface AppState {
  consentToken: string
  userName: string
  ageGroup: string
  fileId: string
  voiceSampleId: string
  analysisId: string
  analysisResult: Record<string, unknown> | null
  resultsData: Record<string, unknown> | null
}

function App() {
  const [step, setStep] = useState<AppStep>('home')
  const [history, setHistory] = useState<Array<Record<string, any>>>(() => {
    try {
      return JSON.parse(localStorage.getItem('velora_history') || '[]')
    } catch {
      return []
    }
  })
  const [state, setState] = useState<AppState>({
    consentToken: '',
    userName: '',
    ageGroup: '',
    fileId: '',
    voiceSampleId: '',
    analysisId: '',
    analysisResult: null,
    resultsData: null,
  })

  const saveHistory = (resultsData: Record<string, unknown>) => {
    setHistory(prev => {
      const next = [resultsData as Record<string, any>, ...prev].slice(0, 10)
      localStorage.setItem('velora_history', JSON.stringify(next))
      return next
    })
  }

  const updateState = (partial: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }

  const handleRestart = () => {
    setState({
      consentToken: '',
      userName: '',
      ageGroup: '',
      fileId: '',
      voiceSampleId: '',
      analysisId: '',
      analysisResult: null,
      resultsData: null,
    })
    setStep('home')
  }

  const screenTitle = {
    home: '',
    consent: '계정 만들기',
    upload: '녹음 파일 업로드',
    analyzing: 'AI 분석',
    results: '인지 건강 리포트',
    history: '이력 보기',
    admin: '관리자 콘솔',
  }[step]

  return (
    <div className="min-h-screen bg-[#eef5f2] px-3 py-4 text-[#143c3d] sm:py-8">
      <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[34px] border border-black/10 bg-[#fbfdfb] shadow-2xl shadow-teal-950/10">
        <div className="flex h-8 items-center justify-between px-7 pt-3 text-[11px] font-semibold text-[#173c3d]">
          <span>9:41</span>
          <div className="h-5 w-20 rounded-full bg-black" />
          <span>LTE</span>
        </div>

        {step !== 'home' && (
          <header className="flex items-center justify-between px-5 pb-2 pt-5">
            <button
              onClick={() => {
                if (step === 'consent') setStep('home')
                if (step === 'upload') setStep('consent')
                if (step === 'analyzing') setStep('upload')
                if (step === 'results') handleRestart()
                if (step === 'history') setStep('home')
                if (step === 'admin') setStep('home')
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#0b7074] hover:bg-[#e8f3f1]"
              aria-label="이전"
            >
              ←
            </button>
            <h1 className="text-[17px] font-bold text-[#173c3d]">{screenTitle}</h1>
            <div className="h-9 w-9" />
          </header>
        )}

        <main className="min-h-[760px] px-5 pb-6">
          {step === 'home' && (
            <section className="flex min-h-[760px] flex-col">
              <div className="flex justify-end pt-5">
                <button className="flex h-9 w-9 items-center justify-center rounded-full text-[#0b7074] hover:bg-[#e8f3f1]">
                  <Bell className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <p className="text-[34px] font-black tracking-tight text-[#0c7478]">VELORA</p>
                <p className="mt-2 text-[15px] font-semibold text-[#255a5b]">말로 여는 인지 케어</p>

                <div className="mt-12 flex h-36 w-36 items-center justify-center rounded-full bg-[#d7efea]">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#15908e] shadow-lg shadow-teal-800/20">
                    <Mic className="h-16 w-16 text-white" />
                  </div>
                </div>

                <p className="mt-10 whitespace-pre-line text-[15px] font-semibold leading-7 text-[#255a5b]">
                  말로 테스트하고{'\n'}인지 건강 여정을{'\n'}세심하고 따뜻하게 함께해요.
                </p>
              </div>

              <div className="space-y-3 pb-4">
                <Button
                  className="h-14 w-full rounded-full bg-[#0f7d82] text-base font-bold text-white shadow-none hover:bg-[#0b6f74]"
                  onClick={() => setStep('consent')}
                >
                  시작하기
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-full border-[#dde8e4] bg-white text-sm font-semibold text-[#0f6f73] shadow-none hover:bg-[#f4faf8]"
                  onClick={() => setStep('history')}
                >
                  <History className="mr-2 h-4 w-4" />
                  이력 보기
                </Button>
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-full border-[#dde8e4] bg-white text-sm font-semibold text-[#0f6f73] shadow-none hover:bg-[#f4faf8]"
                  onClick={() => setStep('admin')}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  관리자 콘솔
                </Button>
                <p className="flex items-center justify-center gap-1 pt-5 text-[11px] text-[#7c9694]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  안심하고 사용하세요
                </p>
              </div>
            </section>
          )}

          {step === 'consent' && (
            <ConsentPage
              onComplete={(token, ageGroup, userName) => {
                updateState({ consentToken: token, ageGroup, userName })
                setStep('upload')
              }}
            />
          )}
          {step === 'upload' && (
            <UploadPage
              consentToken={state.consentToken}
              onComplete={(fileId, voiceSampleId) => {
                updateState({ fileId, voiceSampleId })
                setStep('analyzing')
              }}
              onBack={() => setStep('consent')}
            />
          )}
          {step === 'analyzing' && (
            <AnalyzingPage
              fileId={state.fileId}
              voiceSampleId={state.voiceSampleId}
              onComplete={(analysisId, analysisResult, resultsData) => {
                updateState({ analysisId, analysisResult, resultsData })
                saveHistory(resultsData)
                setStep('results')
              }}
              onBack={() => setStep('upload')}
            />
          )}
          {step === 'results' && (
            <ResultsPage
              resultsData={state.resultsData}
              onRestart={handleRestart}
            />
          )}
          {step === 'history' && (
            <HistoryPage
              items={history}
              onSelect={item => {
                updateState({
                  analysisId: String(item.analysis?.analysis_id || ''),
                  analysisResult: item.analysis || null,
                  resultsData: item,
                })
                setStep('results')
              }}
              onRestart={() => setStep('consent')}
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
