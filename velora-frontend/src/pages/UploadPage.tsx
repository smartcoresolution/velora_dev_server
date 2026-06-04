import { useEffect, useRef, useState } from 'react'
import { CheckCircle, CloudUpload, Download, FileAudio, Mic, Music, PhoneCall, Square, UserRoundMinus, X } from 'lucide-react'
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
  original_duration_seconds?: number | null
  trimmed_to_seconds?: number | null
  was_trimmed?: boolean
}

type VoiceInputMode = 'record' | 'file' | null
type AudioPickerTarget = 'voice' | 'parent'

type FileSystemAccessWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: Array<{
      description: string
      accept: Record<string, string[]>
    }>
  }) => Promise<Array<{ getFile: () => Promise<File> }>>
}

const audioFileExtensions = ['.m4a', '.mp3', '.wav', '.flac', '.ogg', '.aac', '.wma', '.webm', '.3gp', '.3ga', '.amr']
const audioInputAccept = audioFileExtensions.join(',')
const audioPickerAccept: Record<string, string[]> = {
  'audio/*': audioFileExtensions,
  'audio/wav': ['.wav'],
  'audio/x-wav': ['.wav'],
  'audio/mpeg': ['.mp3'],
  'audio/mp4': ['.m4a', '.3gp', '.3ga'],
  'audio/aac': ['.aac'],
  'audio/ogg': ['.ogg'],
  'audio/flac': ['.flac'],
  'audio/webm': ['.webm'],
  'application/octet-stream': audioFileExtensions,
}

const CHILD_VOICE_SCRIPT = [
  '안녕하세요. 저는 부모님과의 통화 분석을 위해 제 목소리를 등록하고 있습니다.',
  '이 음성은 통화 녹음에서 제 목소리를 구분하기 위한 기준 샘플입니다.',
  '저는 평소 부모님과 전화할 때와 비슷한 속도와 크기로 말하고 있습니다.',
  '오늘 날씨와 최근에 있었던 일, 그리고 가족과 나눈 대화를 자연스럽게 떠올리며 말해 보겠습니다.',
  '이 녹음은 부모님 음성을 더 정확히 확인하기 위한 참고용으로 사용됩니다.',
]

const audioUploadStateKey = (consentToken: string) => `velora_parent_audio_upload:${consentToken}`
const voiceSampleStateKey = (consentToken: string) => `velora_child_voice_sample:${consentToken}`

export default function UploadPage({ consentToken, onComplete }: UploadPageProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioFileName, setAudioFileName] = useState('')
  const [audioFileSizeMb, setAudioFileSizeMb] = useState('')
  const [voiceFile, setVoiceFile] = useState<File | null>(null)
  const [fileId, setFileId] = useState('')
  const [voiceSampleId, setVoiceSampleId] = useState('')
  const [quality, setQuality] = useState<QualityReport | null>(null)
  const [uploading, setUploading] = useState(false)
  const [audioUploadStatus, setAudioUploadStatus] = useState('')
  const [uploadingVoice, setUploadingVoice] = useState(false)
  const [voiceUploadStatus, setVoiceUploadStatus] = useState('')
  const [voiceUploadAttemptKey, setVoiceUploadAttemptKey] = useState('')
  const [voiceSampleDurationSeconds, setVoiceSampleDurationSeconds] = useState(0)
  const [voiceDownloadUrl, setVoiceDownloadUrl] = useState('')
  const [voiceInputMode, setVoiceInputMode] = useState<VoiceInputMode>(null)
  const [recording, setRecording] = useState(false)
  const [recordingPaused, setRecordingPaused] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [error, setError] = useState('')

  const sharedAudioInputRef = useRef<HTMLInputElement>(null)
  const audioPickerTargetRef = useRef<AudioPickerTarget>('voice')
  const voiceRecordInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current)
      streamRef.current?.getTracks().forEach(track => track.stop())
      if (voiceDownloadUrl) URL.revokeObjectURL(voiceDownloadUrl)
    }
  }, [voiceDownloadUrl])

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(audioUploadStateKey(consentToken)) || 'null') as {
        fileId?: string
        fileName?: string
        fileSizeMb?: string
        quality?: QualityReport
        status?: string
      } | null
      if (!saved?.fileId || !saved.quality) return
      setFileId(saved.fileId)
      setQuality(saved.quality)
      setAudioFileName(saved.fileName || '선택한 통화녹음 파일')
      setAudioFileSizeMb(saved.fileSizeMb || '')
      setAudioUploadStatus(saved.status || '서버 품질 검사가 완료되었습니다.')
    } catch {
      // Restoring upload state is best-effort.
    }
  }, [consentToken])

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(voiceSampleStateKey(consentToken)) || 'null') as {
        sampleId?: string
        durationSeconds?: number
        status?: string
      } | null
      if (!saved?.sampleId) return
      setVoiceSampleId(saved.sampleId)
      setVoiceSampleDurationSeconds(Number(saved.durationSeconds || 0))
      setVoiceUploadStatus(saved.status || '자녀 음성 샘플 등록이 완료되었습니다.')
    } catch {
      // Restoring voice sample state is best-effort.
    }
  }, [consentToken])

  const setCurrentVoiceFile = (file: File, mode: Exclude<VoiceInputMode, null> = 'file') => {
    if (voiceDownloadUrl) URL.revokeObjectURL(voiceDownloadUrl)
    setVoiceFile(file)
    setVoiceDownloadUrl(URL.createObjectURL(file))
    setVoiceInputMode(mode)
    setVoiceSampleId('')
    setVoiceSampleDurationSeconds(0)
    setVoiceUploadStatus('')
  }

  const clearCurrentVoiceFile = () => {
    if (voiceDownloadUrl) URL.revokeObjectURL(voiceDownloadUrl)
    setVoiceFile(null)
    setVoiceDownloadUrl('')
    setVoiceSampleId('')
    setVoiceSampleDurationSeconds(0)
    setVoiceUploadStatus('')
    setVoiceUploadAttemptKey('')
    sessionStorage.removeItem(voiceSampleStateKey(consentToken))
  }

  const stopVoiceTracks = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }

  const startChildRecording = async () => {
    setError('')
    setVoiceInputMode('record')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      voiceRecordInputRef.current?.click()
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
        setCurrentVoiceFile(new File([blob], `velora_child_voice_${Date.now()}.webm`, { type: blob.type }), 'record')
        stopVoiceTracks()
      }

      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecordingPaused(false)
      setRecordingSeconds(0)
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds(prev => prev + 1), 1000)
    } catch {
      setError('마이크 권한을 확인해 주세요. 권한이 어려우면 음성파일 선택을 이용해 주세요.')
      stopVoiceTracks()
    }
  }

  const pauseChildRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause()
      setRecordingPaused(true)
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const resumeChildRecording = () => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume()
      setRecordingPaused(false)
      recordingTimerRef.current = window.setInterval(() => setRecordingSeconds(prev => prev + 1), 1000)
    }
  }

  const stopChildRecording = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    setRecordingPaused(false)
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }

  const setCurrentAudioFile = (file: File) => {
    setAudioFile(file)
    setAudioFileName(file.name)
    setAudioFileSizeMb((file.size / 1024 / 1024).toFixed(1))
    setFileId('')
    setQuality(null)
    setAudioUploadStatus('')
    setError('')
    void handleAudioUpload(file)
  }

  const cancelAudioSelection = () => {
    audioPickerTargetRef.current = 'parent'
    setAudioFile(null)
    setAudioFileName('')
    setAudioFileSizeMb('')
    setFileId('')
    setQuality(null)
    sessionStorage.removeItem(audioUploadStateKey(consentToken))
    setAudioUploadStatus('통화녹음 파일 선택을 중단했습니다. 다시 선택해 주세요.')
    setError('')
  }

  const pickAudioFile = async (allowFallback = true) => {
    const filePicker = (window as FileSystemAccessWindow).showOpenFilePicker
    if (filePicker) {
      try {
        const [handle] = await filePicker({
          multiple: false,
          types: [
            {
              description: '음성 파일',
              accept: audioPickerAccept,
            },
          ],
        })
        if (handle) return await handle.getFile()
        if (!allowFallback) {
          setAudioUploadStatus('파일 선택이 완료되지 않았습니다. 다시 선택해 주세요.')
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (!allowFallback) setAudioUploadStatus('파일 선택이 취소되었거나 앱으로 전달되지 않았습니다. 다른 WAV 파일을 다시 선택해 주세요.')
          return null
        }
        if (!allowFallback) {
          const message = error instanceof Error ? error.message : '파일 탐색기를 열지 못했습니다.'
          setAudioUploadStatus(`파일 탐색기를 열지 못했습니다. 브라우저 새로고침 후 다시 시도해 주세요. (${message})`)
          return null
        }
      }
    }
    if (!allowFallback) {
      setAudioUploadStatus('이 브라우저에서 내 파일 탐색기를 직접 열 수 없습니다. Chrome 탭을 완전히 닫고 다시 접속해 주세요.')
      return null
    }
    sharedAudioInputRef.current?.click()
    return null
  }

  const openVoiceFileSearch = async () => {
    setVoiceInputMode('file')
    audioPickerTargetRef.current = 'voice'
    const file = await pickAudioFile()
    if (file) setCurrentVoiceFile(file, 'file')
  }

  const openAudioFileSearch = async () => {
    audioPickerTargetRef.current = 'parent'
    const file = await pickAudioFile(false)
    if (file) setCurrentAudioFile(file)
  }

  const handleAudioUpload = async (selectedFile = audioFile) => {
    if (!selectedFile) return
    setUploading(true)
    setAudioUploadStatus('파일을 서버로 전송하고 있습니다.')
    setError('')
    try {
      const result = await uploadAudio(selectedFile, consentToken)
      const qualityReport = result.quality_report || {}
      const normalizedQuality: QualityReport = {
        duration_seconds: Number(qualityReport.duration_seconds || 0),
        snr_db: Number(qualityReport.snr_db || 0),
        silence_ratio: Number(qualityReport.silence_ratio || 0),
        sample_rate: Number(qualityReport.sample_rate || 0),
        channels: Number(qualityReport.channels || 0),
        format_original: String(qualityReport.format_original || ''),
        quality_pass: Boolean(qualityReport.quality_pass),
        rejection_reason: qualityReport.rejection_reason || null,
        original_duration_seconds: qualityReport.original_duration_seconds ?? null,
        trimmed_to_seconds: qualityReport.trimmed_to_seconds ?? null,
        was_trimmed: Boolean(qualityReport.was_trimmed),
      }
      sessionStorage.setItem(audioUploadStateKey(consentToken), JSON.stringify({
        fileId: result.file_id,
        fileName: selectedFile.name,
        fileSizeMb: (selectedFile.size / 1024 / 1024).toFixed(1),
        quality: normalizedQuality,
        status: result.message || '서버 품질 검사가 완료되었습니다.',
      }))
      setAudioUploadStatus(result.message || '서버 품질 검사가 완료되었습니다.')
      setFileId(result.file_id)
      setQuality(normalizedQuality)
      setUploading(false)
    } catch (e) {
      const message = e instanceof Error ? e.message : '업로드에 실패했습니다.'
      setAudioUploadStatus('')
      setError(message)
      setUploading(false)
    }
  }

  const handleVoiceUpload = async () => {
    if (!voiceFile) return
    setUploadingVoice(true)
    setVoiceUploadStatus('자녀 음성 샘플을 등록하고 있습니다.')
    setError('')
    try {
      const result = await uploadVoiceSample(voiceFile, consentToken)
      setVoiceSampleId(result.sample_id)
      setVoiceSampleDurationSeconds(Number(result.duration_seconds || 0))
      setVoiceUploadStatus(result.message || '자녀 음성 샘플 등록이 완료되었습니다.')
      sessionStorage.setItem(voiceSampleStateKey(consentToken), JSON.stringify({
        sampleId: result.sample_id,
        durationSeconds: Number(result.duration_seconds || 0),
        status: result.message || '자녀 음성 샘플 등록이 완료되었습니다.',
      }))
    } catch (e) {
      setVoiceUploadStatus('')
      setError(e instanceof Error ? e.message : '음성 샘플 등록에 실패했습니다.')
    } finally {
      setUploadingVoice(false)
    }
  }

  useEffect(() => {
    if (!voiceFile || !consentToken || voiceSampleId || uploadingVoice) return
    const attemptKey = `${voiceFile.name}:${voiceFile.size}:${voiceFile.lastModified}`
    if (voiceUploadAttemptKey === attemptKey) return
    setVoiceUploadAttemptKey(attemptKey)
    void handleVoiceUpload()
  }, [consentToken, uploadingVoice, voiceFile, voiceSampleId, voiceUploadAttemptKey])

  const canProceed = Boolean(fileId && quality?.quality_pass && voiceSampleId)
  const recordingTimeText = `${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`
  const voiceStatusText = recording ? recordingTimeText : voiceFile ? (voiceInputMode === 'record' ? '녹음 완료' : '파일 선택 완료') : '20~30초'
  const audioUploadComplete = Boolean(fileId && quality)
  const qualityDuration = Number(quality?.duration_seconds || 0)
  const qualitySnr = Number(quality?.snr_db || 0)
  const qualitySilenceRatio = Number(quality?.silence_ratio || 0)

  return (
    <div className="space-y-5 pt-2">
      <section className="rounded-2xl border border-[#dce9e6] bg-[#f7fbfa] p-4">
        <div className="flex items-start gap-3">
          <UserRoundMinus className="mt-0.5 h-6 w-6 shrink-0 text-[#0f7d82]" />
          <div>
            <p className="text-[17px] font-black text-[#183f40]">자녀 음성을 먼저 등록</p>
            <p className="mt-1 text-[15px] font-semibold leading-[1.42] text-[#607b79]">
              통화 속 자녀 목소리를 찾아 제외하고, 부모님 음성을 분석합니다.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] bg-[#0d777c] p-5 text-white shadow-lg shadow-teal-900/15">
        <div className="rounded-2xl bg-white px-4 py-3 text-[15px] font-black leading-[1.42] text-[#25494a]">
          조용한 곳에서 자녀 본인의 목소리를 20~30초 정도 녹음해 주세요. 20초보다 짧으면 다시 녹음해야 하고, 30초를 넘으면 앞부분 30초만 사용합니다.
        </div>
        <div className="mt-4 space-y-1.5 rounded-2xl bg-white/12 px-4 py-4 text-[16px] font-bold leading-[1.42] text-white">
          {CHILD_VOICE_SCRIPT.map(line => (
            <p key={line}>{line}</p>
          ))}
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
        <p className="text-center text-[30px] font-light tabular-nums">{voiceStatusText}</p>
        <div className="mt-4 h-1.5 rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${voiceFile ? 100 : Math.min(100, Math.max(8, (recordingSeconds / 30) * 100))}%` }}
          />
        </div>
        {recording ? (
          <div className="mt-7 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={recordingPaused ? resumeChildRecording : pauseChildRecording}
              className="h-16 rounded-full border-white/30 bg-white/10 text-[17px] font-black text-white shadow-none hover:bg-white/20"
            >
              {recordingPaused ? (
                <>
                  <Mic className="mr-2 h-5 w-5" />
                  계속 녹음
                </>
              ) : (
                <>
                  <Square className="mr-2 h-5 w-5" />
                  녹음 멈춤
                </>
              )}
            </Button>
            <Button
              onClick={stopChildRecording}
              className="h-16 rounded-full bg-white text-[17px] font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
            >
              <CheckCircle className="mr-2 h-5 w-5" />
              녹음 끝내기
            </Button>
          </div>
        ) : !voiceInputMode && !voiceFile ? (
          <div className="mt-7 grid grid-cols-2 gap-2">
            <Button
              onClick={startChildRecording}
              className="h-16 rounded-full bg-white text-[17px] font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
            >
              <Mic className="mr-2 h-5 w-5" />
              음성 녹음
            </Button>
            <Button
              variant="outline"
              onClick={openVoiceFileSearch}
              className="h-16 rounded-full border-white/30 bg-white/10 text-[17px] font-black text-white shadow-none hover:bg-white/20"
            >
              <FileAudio className="mr-2 h-5 w-5" />
              음성파일 선택
            </Button>
          </div>
        ) : null}

        {voiceInputMode === 'record' && !voiceFile && !recording ? (
          <Button
            onClick={startChildRecording}
            className="mt-7 h-16 w-full rounded-full bg-white text-[18px] font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
          >
            <>
              <Mic className="mr-2 h-5 w-5" />
              음성 녹음 시작
            </>
          </Button>
        ) : voiceInputMode === 'file' && !voiceFile ? (
          <Button
            variant="outline"
            onClick={openVoiceFileSearch}
            className="mt-7 h-16 w-full rounded-full border-white/30 bg-white/10 text-[18px] font-black text-white shadow-none hover:bg-white/20"
          >
            <FileAudio className="mr-2 h-5 w-5" />
            자녀 음성파일 선택
          </Button>
        ) : null}

        {voiceFile && (
          <div className="mt-3 space-y-2">
            <Button
              onClick={handleVoiceUpload}
              disabled={uploadingVoice || Boolean(voiceSampleId)}
              className="h-14 w-full rounded-full bg-white px-5 text-[17px] font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
            >
              {voiceSampleId ? '등록 완료' : uploadingVoice ? '자동 등록 중' : '선택된 음성 샘플 등록'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  clearCurrentVoiceFile()
                  setVoiceInputMode('record')
                  void startChildRecording()
                }}
                className="h-14 rounded-full border-white/30 bg-white/10 text-[16px] font-black text-white shadow-none hover:bg-white/20"
              >
                <Mic className="mr-2 h-5 w-5" />
                다시 녹음
              </Button>
              <Button
                variant="outline"
                onClick={openVoiceFileSearch}
                className="h-14 rounded-full border-white/30 bg-white/10 text-[16px] font-black text-white shadow-none hover:bg-white/20"
              >
                <FileAudio className="mr-2 h-5 w-5" />
                다른 파일 찾기
              </Button>
            </div>
          </div>
        )}
        {voiceFile && voiceDownloadUrl && (
          <a
            href={voiceDownloadUrl}
            download={voiceFile.name}
            className="mt-3 flex h-14 w-full items-center justify-center rounded-full border border-white/25 bg-white/10 text-[16px] font-black text-white hover:bg-white/20"
          >
            <Download className="mr-2 h-5 w-5" />
            녹음한 자녀 음성 다운로드
          </a>
        )}
        {voiceFile && (
          <p className="mt-3 truncate text-center text-[15px] font-bold text-white/80">{voiceFile.name}</p>
        )}
        {voiceUploadStatus && (
          <p className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-center text-[15px] font-bold leading-[1.42] text-white">
            {voiceUploadStatus}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[#dce9e6] bg-white p-4">
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-[#f1f8f6] px-3 py-3">
          <PhoneCall className="mt-0.5 h-6 w-6 shrink-0 text-[#0f7d82]" />
          <div>
            <p className="text-[17px] font-black text-[#183f40]">부모님과의 통화녹음 업로드</p>
            <p className="mt-1 text-[15px] font-semibold leading-[1.42] text-[#607b79]">스마트폰 전화 앱이나 내 파일에 저장된 통화녹음 음성 파일을 선택해 주세요.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openAudioFileSearch}
          className="flex w-full flex-col items-center rounded-2xl border border-dashed border-[#b8cfcb] bg-[#f7fbfa] px-4 py-6 text-center"
        >
          <CloudUpload className="h-10 w-10 text-[#0f7d82]" />
          <span className="mt-3 text-[17px] font-black text-[#183f40]">내 파일에서 통화녹음 선택</span>
          <span className="mt-1 text-[14px] font-semibold text-[#7d9593]">.m4a, .wav 등 음성 파일 지원</span>
        </button>
        {(audioFile || fileId) && (
          <div className="mt-4 rounded-2xl bg-[#f1f8f6] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0f7d82] text-white">
                <Music className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-black text-[#183f40]">{audioFile?.name || audioFileName || '선택한 통화녹음 파일'}</p>
                {(audioFile || audioFileSizeMb) && (
                  <p className="text-[13px] font-semibold text-[#6f8785]">{audioFile ? (audioFile.size / 1024 / 1024).toFixed(1) : audioFileSizeMb}MB</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setAudioFile(null)
                  setAudioFileName('')
                  setAudioFileSizeMb('')
                  setFileId('')
                  setQuality(null)
                  sessionStorage.removeItem(audioUploadStateKey(consentToken))
                  setAudioUploadStatus('')
                }}
                className="text-[#7d9593]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-1.5 text-[14px] font-bold leading-[1.42] text-[#426160]">
              <p className="flex items-center gap-2"><CheckCircle className="h-5 w-5 shrink-0 text-[#0f7d82]" /> 형식: 서버 품질 검사에서 확인</p>
              <p className="flex items-center gap-2"><CheckCircle className="h-5 w-5 shrink-0 text-[#0f7d82]" /> 전체 통화: 최소 30초 이상</p>
              <p className="flex items-center gap-2"><CheckCircle className="h-5 w-5 shrink-0 text-[#0f7d82]" /> 긴 통화: 분석용으로 앞부분 3분만 사용</p>
              <p className="flex items-center gap-2"><CheckCircle className="h-5 w-5 shrink-0 text-[#0f7d82]" /> 부모 발화량: 30초 이상 권장</p>
            </div>
          </div>
        )}

        {quality && (
          <div className={`mt-4 rounded-2xl p-4 ${quality.quality_pass ? 'bg-[#edf8f4]' : 'bg-red-50'}`}>
            <p className={`text-[16px] font-black ${quality.quality_pass ? 'text-[#0f7d82]' : 'text-red-600'}`}>
              {quality.quality_pass ? '품질 검증 통과' : '품질 검증 실패'}
            </p>
            <p className="mt-2 text-[14px] font-semibold leading-[1.42] text-[#6f8785]">
              길이 {qualityDuration.toFixed(1)}초 · SNR {qualitySnr.toFixed(1)}dB · 무음 {(qualitySilenceRatio * 100).toFixed(1)}%
            </p>
            {quality.rejection_reason && <p className="mt-2 text-[14px] font-semibold leading-[1.42] text-red-600">{quality.rejection_reason}</p>}
            {quality.was_trimmed && (
              <p className="mt-2 text-[14px] font-bold leading-[1.42] text-[#0f7d82]">
                원본 {Number(quality.original_duration_seconds || 0).toFixed(1)}초 중 앞부분 {Number(quality.trimmed_to_seconds || quality.duration_seconds).toFixed(0)}초만 분석에 사용합니다.
              </p>
            )}
          </div>
        )}

        {!audioUploadComplete && (
          <Button
            onClick={() => handleAudioUpload()}
            disabled={!audioFile || uploading}
            className="mt-4 h-16 w-full rounded-full bg-[#0f7d82] text-[18px] font-black text-white shadow-none hover:bg-[#0b6f74]"
          >
            {uploading ? '전송 및 품질 검사 중...' : '통화 파일 업로드'}
          </Button>
        )}
        {audioUploadStatus && (
          <div className="mt-3 rounded-xl bg-[#eef7fb] px-4 py-3 text-center text-[15px] font-bold leading-[1.42] text-[#426160]">
            <p>{audioUploadStatus}</p>
            {!audioFile && !fileId && !uploading && (
              <button
                type="button"
                onClick={cancelAudioSelection}
                className="mt-2 h-11 rounded-full border border-[#b8cfcb] bg-white px-4 text-[15px] font-black text-[#0f7d82]"
              >
                선택 중단
              </button>
            )}
          </div>
        )}
      </section>

      <input
        ref={voiceRecordInputRef}
        type="file"
        accept="audio/*"
        capture
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) setCurrentVoiceFile(file, 'record')
        }}
      />
      <input
        ref={sharedAudioInputRef}
        type="file"
        accept={audioInputAccept}
        className="hidden"
        onClick={e => {
          e.currentTarget.value = ''
        }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (!file) {
            if (audioPickerTargetRef.current === 'parent') {
              setAudioUploadStatus('파일 선택이 완료되지 않았습니다. 다시 선택해 주세요.')
            }
            return
          }
          if (audioPickerTargetRef.current === 'parent') {
            setCurrentAudioFile(file)
          } else {
            setCurrentVoiceFile(file)
          }
        }}
      />

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-[15px] font-bold leading-[1.42] text-red-600">{error}</p>}

      <Button
        onClick={() => onComplete(fileId, voiceSampleId, voiceSampleDurationSeconds || 0)}
        disabled={!canProceed}
        className="h-16 w-full rounded-full bg-[#0f7d82] text-[18px] font-black text-white shadow-none hover:bg-[#0b6f74]"
      >
        분석 시작
      </Button>

      <p className="flex items-center justify-center gap-1 text-[14px] font-semibold leading-[1.42] text-[#8aa09e]">
        <CheckCircle className="h-4 w-4 shrink-0" />
          자녀 음성 샘플 등록과 통화 파일 확인을 마친 뒤 분석을 시작합니다.
      </p>
    </div>
  )
}
