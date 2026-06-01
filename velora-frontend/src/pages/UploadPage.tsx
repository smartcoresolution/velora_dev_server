import { useEffect, useRef, useState } from 'react'
import { CheckCircle, CloudUpload, Download, FileAudio, Info, Mic, Music, PhoneCall, Square, UserRoundMinus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadAudio, uploadVoiceSample } from '@/lib/api'

interface UploadPageProps {
  consentToken: string
  onComplete: (fileId: string, voiceSampleId: string, voiceSampleDurationSeconds: number) => void
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

export default function UploadPage({ consentToken, onComplete }: UploadPageProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [voiceFile, setVoiceFile] = useState<File | null>(null)
  const [fileId, setFileId] = useState('')
  const [voiceSampleId, setVoiceSampleId] = useState('')
  const [quality, setQuality] = useState<QualityReport | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingVoice, setUploadingVoice] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingPaused, setRecordingPaused] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [voiceSampleDurationSeconds, setVoiceSampleDurationSeconds] = useState(0)
  const [voiceDownloadUrl, setVoiceDownloadUrl] = useState('')
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
      if (voiceDownloadUrl) URL.revokeObjectURL(voiceDownloadUrl)
    }
  }, [voiceDownloadUrl])

  const setCurrentVoiceFile = (file: File) => {
    if (voiceDownloadUrl) URL.revokeObjectURL(voiceDownloadUrl)
    setVoiceFile(file)
    setVoiceDownloadUrl(URL.createObjectURL(file))
    setVoiceSampleId('')
    setVoiceSampleDurationSeconds(0)
  }

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
        setCurrentVoiceFile(new File([blob], `velora_child_voice_${Date.now()}.webm`, { type: blob.type }))
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
    setVoiceSampleDurationSeconds(recordingSeconds)
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    setRecordingPaused(false)
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const pauseRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause()
      setRecordingPaused(true)
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const resumeRecording = () => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume()
      setRecordingPaused(false)
      timerRef.current = window.setInterval(() => setRecordingSeconds(prev => prev + 1), 1000)
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
      setVoiceSampleDurationSeconds(Number(result.duration_seconds || 0))
    } catch (e) {
      setError(e instanceof Error ? e.message : '음성 샘플 등록에 실패했습니다.')
    } finally {
      setUploadingVoice(false)
    }
  }

  const canProceed = Boolean(fileId && quality?.quality_pass && voiceFile)
  const time = `${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`

  return (
    <div className="space-y-5 pt-2">
      <section className="rounded-2xl border border-[#dce9e6] bg-[#f7fbfa] p-4">
        <div className="flex items-start gap-3">
          <UserRoundMinus className="mt-0.5 h-5 w-5 shrink-0 text-[#0f7d82]" />
          <div>
            <p className="text-[14px] font-black text-[#183f40]">자녀 음성을 먼저 등록</p>
            <p className="mt-1 text-[12px] leading-5 text-[#607b79]">
              통화 속 자녀 목소리를 찾아 제외하고, 부모님 음성을 분석합니다.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] bg-[#0d777c] p-5 text-white shadow-lg shadow-teal-900/15">
        <div className="rounded-2xl bg-white px-4 py-3 text-[13px] font-bold leading-5 text-[#25494a]">
          조용한 곳에서 자녀 본인의 목소리를 20초 이상 녹음해 주세요.
        </div>
        <div className="mt-3 rounded-2xl bg-white/12 px-4 py-3 text-[12px] font-semibold leading-5 text-white">
          안녕하세요. 저는 부모님과의 통화 분석을 위해 제 목소리를 등록하고 있습니다.
          이 음성은 통화 녹음에서 제 목소리를 구분하기 위한 기준 샘플입니다.
          저는 평소 부모님과 전화할 때와 비슷한 속도와 크기로 말하고 있습니다.
          오늘 날씨와 최근에 있었던 일, 그리고 가족과 나눈 대화를 자연스럽게 떠올리며 말해 보겠습니다.
          이 녹음은 부모님 음성을 더 정확히 확인하기 위한 참고용으로 사용됩니다.
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
        <p className="text-center text-[30px] font-light tabular-nums">{recording || voiceFile ? time : '00:20'}</p>
        <div className="mt-4 h-1.5 rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${Math.min(100, Math.max(8, (recordingSeconds / 20) * 100))}%` }}
          />
        </div>
        {recording ? (
          <div className="mt-7 grid grid-cols-2 gap-2">
            <Button
              onClick={recordingPaused ? resumeRecording : pauseRecording}
              className="h-14 rounded-full bg-white/12 text-[14px] font-black text-white shadow-none ring-1 ring-white/30 hover:bg-white/20"
            >
              {recordingPaused ? (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  다시 녹음
                </>
              ) : (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  녹음 멈춤
                </>
              )}
            </Button>
            <Button
              onClick={stopRecording}
              className="h-14 rounded-full bg-white text-[14px] font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              녹음 끝내기
            </Button>
          </div>
        ) : (
          <Button
            onClick={startRecording}
            className="mt-7 h-14 w-full rounded-full bg-white text-[15px] font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
          >
            <>
              <Mic className="mr-2 h-4 w-4" />
              자녀 음성 녹음
            </>
          </Button>
        )}
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="h-11 flex-1 rounded-full border-white/30 bg-white/10 text-white shadow-none hover:bg-white/20"
            onClick={() => voiceInputRef.current?.click()}
          >
            <FileAudio className="mr-2 h-4 w-4" />
            파일 선택
          </Button>
          {voiceFile && (
            <Button
              onClick={handleVoiceUpload}
              disabled={uploadingVoice || recording}
              className="h-11 rounded-full bg-white px-5 font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
            >
              {voiceSampleId ? '등록 완료' : uploadingVoice ? '등록 중' : '샘플 등록'}
            </Button>
          )}
        </div>
        {voiceFile && voiceDownloadUrl && (
          <a
            href={voiceDownloadUrl}
            download={voiceFile.name}
            className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-white/25 bg-white/10 text-[13px] font-black text-white hover:bg-white/20"
          >
            <Download className="mr-2 h-4 w-4" />
            녹음한 자녀 음성 다운로드
          </a>
        )}
        {voiceFile && (
          <p className="mt-3 truncate text-center text-[12px] font-semibold text-white/80">{voiceFile.name}</p>
        )}
      </section>

      <section className="rounded-2xl border border-[#dce9e6] bg-white p-4">
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-[#f1f8f6] px-3 py-3">
          <PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-[#0f7d82]" />
          <div>
            <p className="text-[13px] font-black text-[#183f40]">부모님과의 통화녹음 업로드</p>
            <p className="mt-1 text-[12px] leading-5 text-[#607b79]">스마트폰 전화 앱에 저장된 .m4a 파일을 그대로 선택해 주세요.</p>
          </div>
        </div>
        <button
          onClick={() => audioInputRef.current?.click()}
          disabled={recording}
          className="flex w-full flex-col items-center rounded-2xl border border-dashed border-[#b8cfcb] bg-[#f7fbfa] px-4 py-6 text-center"
        >
          <CloudUpload className="h-9 w-9 text-[#0f7d82]" />
          <span className="mt-3 text-[14px] font-black text-[#183f40]">통화녹음 파일 선택</span>
          <span className="mt-1 text-[11px] text-[#7d9593]">.m4a 권장 / 최소 1분 / 최대 100MB</span>
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
              <p className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#0f7d82]" /> 전체 통화: 최소 1분 권장</p>
              <p className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-[#0f7d82]" /> 부모 발화량: 30초 이상 권장</p>
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
          {uploading ? '업로드 및 검증 중...' : '통화 파일 업로드'}
        </Button>
      </section>

      <section className="rounded-2xl border border-[#dce9e6] bg-white p-4">
        <div className="flex items-start gap-2 rounded-xl bg-[#eef7fb] px-3 py-3 text-[12px] leading-5 text-[#426160]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7d82]" />
          자녀 음성 샘플은 화자 제외에 사용됩니다. 통화 원본과 분석용 분리 음성은 분석 후 삭제되는 것을 원칙으로 합니다.
        </div>
        <input
          ref={voiceInputRef}
          type="file"
          accept=".m4a,.mp3,.wav,.flac,.ogg,.aac,.wma,.webm,.mp4,audio/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) setCurrentVoiceFile(file)
          }}
        />
      </section>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-600">{error}</p>}

      <Button
        onClick={() => onComplete(fileId, voiceSampleId, voiceSampleDurationSeconds || recordingSeconds || 0)}
        disabled={!canProceed}
        className="h-14 w-full rounded-full bg-[#0f7d82] text-[15px] font-bold text-white shadow-none hover:bg-[#0b6f74]"
      >
        분석 시작
      </Button>

      <p className="flex items-center justify-center gap-1 text-[11px] text-[#8aa09e]">
        <CheckCircle className="h-3.5 w-3.5" />
        자녀 음성 샘플과 통화 파일을 확인한 뒤 분석을 시작합니다.
      </p>
    </div>
  )
}
