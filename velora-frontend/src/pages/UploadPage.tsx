import { useEffect, useRef, useState } from 'react'
import { CheckCircle, CloudUpload, FileAudio, Info, Mic, Music, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadAudio, uploadVoiceSample } from '@/lib/api'

interface UploadPageProps {
  consentToken: string
  onComplete: (fileId: string, voiceSampleId: string) => void
  onBack: () => void
}

interface QualityReport {
  duration_seconds: number
  snr_db: number
  silence_ratio: number
  sample_rate: number
  channels: number
  format_original: string
  quality_pass: boolean
  rejection_reason: string | null
}

const SCRIPTS = [
  {
    title: '스크립트 1',
    label: '종합신경인지검사 일부',
    detail: '오늘은 몇 월 며칠입니까? 여기는 어디입니까?',
  },
  {
    title: '스크립트 2',
    label: '기억력 평가',
    detail: '지금부터 단어를 들려드릴게요. 잘 듣고 기억해 주세요.',
  },
  {
    title: '스크립트 3',
    label: '언어 유창성 평가',
    detail: '1분 동안 동물 이름을 가능한 많이 말씀해 주세요.',
  },
]

export default function UploadPage({ consentToken, onComplete }: UploadPageProps) {
  const [selectedScript, setSelectedScript] = useState(0)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [voiceFile, setVoiceFile] = useState<File | null>(null)
  const [fileId, setFileId] = useState('')
  const [voiceSampleId, setVoiceSampleId] = useState('')
  const [quality, setQuality] = useState<QualityReport | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingVoice, setUploadingVoice] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [error, setError] = useState('')

  const audioInputRef = useRef<HTMLInputElement>(null)
  const voiceInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }

  const startRecording = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('현재 브라우저에서 녹음을 지원하지 않습니다. 파일 업로드를 이용해 주세요.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setAudioFile(new File([blob], `velora_record_${Date.now()}.webm`, { type: blob.type }))
        stopTracks()
      }

      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecordingSeconds(0)
      timerRef.current = window.setInterval(() => setRecordingSeconds(prev => prev + 1), 1000)
    } catch {
      setError('마이크 권한을 확인해 주세요.')
      stopTracks()
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const handleAudioUpload = async () => {
    if (!audioFile) return
    setUploading(true)
    setError('')
    try {
      const result = await uploadAudio(audioFile, consentToken)
      setFileId(result.file_id)
      setQuality(result.quality_report)
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleVoiceUpload = async () => {
    if (!voiceFile) return
    setUploadingVoice(true)
    setError('')
    try {
      const result = await uploadVoiceSample(voiceFile, consentToken)
      setVoiceSampleId(result.sample_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '음성 샘플 등록에 실패했습니다.')
    } finally {
      setUploadingVoice(false)
    }
  }

  const canProceed = Boolean(fileId && quality?.quality_pass)
  const time = `${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`

  return (
    <div className="space-y-5 pt-2">
      <section className="space-y-3">
        <p className="text-center text-[13px] font-semibold leading-5 text-[#426160]">
          녹음에 사용할 스크립트를 1개 선택해 주세요.
        </p>
        {SCRIPTS.map((script, idx) => (
          <button
            key={script.title}
            onClick={() => setSelectedScript(idx)}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              selectedScript === idx
                ? 'border-[#0f7d82] bg-[#eff9f6] shadow-sm'
                : 'border-[#e3ece9] bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                selectedScript === idx ? 'border-[#0f7d82] bg-[#0f7d82]' : 'border-[#b8c9c6]'
              }`}>
                {selectedScript === idx && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <div>
                <p className="text-[13px] font-black text-[#183f40]">{script.title}</p>
                <p className="mt-1 text-[12px] font-bold text-[#426160]">{script.label}</p>
                <p className="mt-2 text-[12px] leading-5 text-[#6f8785]">{script.detail}</p>
              </div>
            </div>
          </button>
        ))}
      </section>

      <section className="overflow-hidden rounded-[28px] bg-[#0d777c] p-5 text-white shadow-lg shadow-teal-900/15">
        <div className="rounded-2xl bg-white px-4 py-3 text-[13px] font-bold leading-5 text-[#25494a]">
          {SCRIPTS[selectedScript].detail}
        </div>
        <div className="relative my-8 flex h-28 items-center justify-center">
          <div className="absolute h-28 w-28 rounded-full border border-white/25" />
          <div className="flex items-end gap-1">
            {Array.from({ length: 25 }).map((_, idx) => (
              <span
                key={idx}
                className="w-1 rounded-full bg-white/75"
                style={{ height: `${18 + Math.abs(12 - idx) * (idx % 2 ? 2.1 : 1.25)}px` }}
              />
            ))}
          </div>
        </div>
        <p className="text-center text-[30px] font-light tabular-nums">{recording ? time : '00:45'}</p>
        <div className="mt-4 h-1.5 rounded-full bg-white/25">
          <div className="h-full w-2/5 rounded-full bg-white" />
        </div>
        <Button
          onClick={recording ? stopRecording : startRecording}
          className="mt-7 h-14 w-full rounded-full bg-white text-[15px] font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
        >
          {recording ? (
            <>
              <Square className="mr-2 h-4 w-4 fill-current" />
              녹음 중지 및 저장
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" />
              선택한 스크립트로 녹음하기
            </>
          )}
        </Button>
      </section>

      <section className="rounded-2xl border border-[#dce9e6] bg-white p-4">
        <button
          onClick={() => audioInputRef.current?.click()}
          disabled={recording}
          className="flex w-full flex-col items-center rounded-2xl border border-dashed border-[#b8cfcb] bg-[#f7fbfa] px-4 py-6 text-center"
        >
          <CloudUpload className="h-9 w-9 text-[#0f7d82]" />
          <span className="mt-3 text-[14px] font-black text-[#183f40]">녹음 파일 선택 또는 드래그</span>
          <span className="mt-1 text-[11px] text-[#7d9593]">지원 형식 .m4a, .mp3, .wav, .webm 등 / 최대 100MB</span>
        </button>
        <input
          ref={audioInputRef}
          type="file"
          accept=".m4a,.mp3,.wav,.flac,.ogg,.aac,.wma,.webm,.mp4,audio/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) {
              setAudioFile(file)
              setFileId('')
              setQuality(null)
            }
          }}
        />

        {audioFile && (
          <div className="mt-4 rounded-2xl bg-[#f1f8f6] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f7d82] text-white">
                <Music className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black text-[#183f40]">{audioFile.name}</p>
                <p className="text-[11px] text-[#6f8785]">{(audioFile.size / 1024 / 1024).toFixed(1)}MB</p>
              </div>
              <button onClick={() => setAudioFile(null)} className="text-[#7d9593]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-[12px] font-semibold text-[#426160]">
              <p className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#0f7d82]" /> 형식: 서버 품질 검사에서 확인</p>
              <p className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#0f7d82]" /> 길이: 최소 30초 필요</p>
              <p className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#0f7d82]" /> 개인정보 포함 여부 확인</p>
            </div>
          </div>
        )}

        {quality && (
          <div className={`mt-4 rounded-2xl p-4 ${quality.quality_pass ? 'bg-[#edf8f4]' : 'bg-red-50'}`}>
            <p className={`text-[13px] font-black ${quality.quality_pass ? 'text-[#0f7d82]' : 'text-red-600'}`}>
              {quality.quality_pass ? '품질 검증 통과' : '품질 검증 실패'}
            </p>
            <p className="mt-2 text-[12px] text-[#6f8785]">
              길이 {quality.duration_seconds.toFixed(1)}초 · SNR {quality.snr_db.toFixed(1)}dB · 무음 {(quality.silence_ratio * 100).toFixed(1)}%
            </p>
            {quality.rejection_reason && <p className="mt-2 text-[12px] text-red-600">{quality.rejection_reason}</p>}
          </div>
        )}

        <Button
          onClick={handleAudioUpload}
          disabled={!audioFile || uploading || recording}
          className="mt-4 h-[52px] w-full rounded-full bg-[#0f7d82] text-[14px] font-black text-white shadow-none hover:bg-[#0b6f74]"
        >
          {uploading ? '업로드 및 검증 중...' : '업로드 및 다음'}
        </Button>
      </section>

      <section className="rounded-2xl border border-[#dce9e6] bg-white p-4">
        <div className="flex items-start gap-2 rounded-xl bg-[#eef7fb] px-3 py-3 text-[12px] leading-5 text-[#426160]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7d82]" />
          본인 음성 샘플을 등록하면 통화 속 화자를 더 정확히 구분할 수 있습니다.
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-full border-[#dce9e6] text-[#0f7d82] shadow-none"
            onClick={() => voiceInputRef.current?.click()}
          >
            <FileAudio className="mr-2 h-4 w-4" />
            {voiceFile ? '샘플 선택됨' : '음성 샘플'}
          </Button>
          {voiceFile && (
            <Button
              onClick={handleVoiceUpload}
              disabled={uploadingVoice}
              className="h-11 rounded-full bg-[#0f7d82] px-5 text-white shadow-none"
            >
              {voiceSampleId ? '완료' : uploadingVoice ? '등록 중' : '등록'}
            </Button>
          )}
        </div>
        <input
          ref={voiceInputRef}
          type="file"
          accept=".m4a,.mp3,.wav,.flac,.ogg,.aac,.wma,.webm,.mp4,audio/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) setVoiceFile(file)
          }}
        />
      </section>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-600">{error}</p>}

      <Button
        onClick={() => onComplete(fileId, voiceSampleId)}
        disabled={!canProceed}
        className="h-14 w-full rounded-full bg-[#0f7d82] text-[15px] font-bold text-white shadow-none hover:bg-[#0b6f74]"
      >
        선택한 파일로 분석 시작
      </Button>

      <p className="flex items-center justify-center gap-1 text-[11px] text-[#8aa09e]">
        <CheckCircle className="h-3.5 w-3.5" />
        업로드된 파일은 안전하게 암호화되어 보호됩니다.
      </p>
    </div>
  )
}
