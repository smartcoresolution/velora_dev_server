import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Download, FileAudio, Mic, Music, Square, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadAudio } from '@/lib/api'

interface SelfVoicePageProps {
  consentToken: string
  onComplete: (fileId: string, durationSeconds: number) => void
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

const SELF_VOICE_SCRIPT = [
  '오늘은 조용한 곳에서 제 목소리를 자연스럽게 녹음하고 있습니다.',
  '아침에는 물을 한 잔 마시고 창밖의 날씨를 살펴보았습니다.',
  '요즘은 가족과 친구들의 안부를 묻고, 하루 일정을 차분히 정리하려고 합니다.',
  '장을 볼 때는 필요한 물건을 미리 적어 두고, 천천히 확인하면서 고릅니다.',
  '가끔 단어가 바로 떠오르지 않을 때도 있지만, 서두르지 않고 다시 생각해 봅니다.',
  '이 녹음은 제 목소리의 말 속도와 멈춤, 발음의 변화를 참고하기 위한 것입니다.',
]

export default function SelfVoicePage({ consentToken, onComplete }: SelfVoicePageProps) {
  const [voiceFile, setVoiceFile] = useState<File | null>(null)
  const [fileId, setFileId] = useState('')
  const [quality, setQuality] = useState<QualityReport | null>(null)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingPaused, setRecordingPaused] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [voiceDownloadUrl, setVoiceDownloadUrl] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')
  const [downloadStatus, setDownloadStatus] = useState('')
  const [error, setError] = useState('')

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
    setFileId('')
    setQuality(null)
    setUploadStatus('')
    setDownloadStatus('')
  }

  const clearVoiceFile = () => {
    if (voiceDownloadUrl) URL.revokeObjectURL(voiceDownloadUrl)
    setVoiceFile(null)
    setVoiceDownloadUrl('')
    setFileId('')
    setQuality(null)
    setUploadStatus('')
    setDownloadStatus('')
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
        const file = new File([blob], `velora_self_voice_${Date.now()}.webm`, { type: blob.type })
        setCurrentVoiceFile(file)
        void handleUpload(file)
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

  const stopRecording = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setRecording(false)
    setRecordingPaused(false)
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const handleUpload = async (selectedFile = voiceFile) => {
    if (!selectedFile) return
    setUploading(true)
    setUploadStatus('품질 검증을 진행하고 있습니다.')
    setError('')
    try {
      const result = await uploadAudio(selectedFile, consentToken)
      setFileId(result.file_id)
      setQuality(result.quality_report)
      setUploadStatus(result.quality_report?.quality_pass ? '품질 검증이 완료되었습니다.' : '품질 검증 결과를 확인해 주세요.')
    } catch (e) {
      setUploadStatus('')
      setError(e instanceof Error ? e.message : '음성 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const openVoiceFileSearch = async () => {
    setError('')
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
        const file = await handle?.getFile()
        if (file) {
          setCurrentVoiceFile(file)
          void handleUpload(file)
        }
        return
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setError('파일 탐색기를 열지 못했습니다. 브라우저 새로고침 후 다시 시도해 주세요.')
        }
        return
      }
    }
    voiceInputRef.current?.click()
  }

  const time = `${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`
  const canProceed = Boolean(fileId && quality?.quality_pass)

  return (
    <div className="space-y-5 pt-2">
      <section className="overflow-hidden rounded-[28px] bg-[#0d777c] p-5 text-white shadow-lg shadow-teal-900/15">
        <div className="rounded-2xl bg-white px-4 py-3 text-[15px] font-black leading-6 text-[#25494a]">
          조용한 곳에서 30초 이상 천천히 읽어 주세요.
        </div>
        <div className="mt-4 space-y-1.5 rounded-2xl bg-white/12 px-4 py-4 text-[16px] font-bold leading-[1.42] text-white">
          {SELF_VOICE_SCRIPT.map(line => (
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
                style={{ height: `${16 + Math.abs(12 - idx) * (idx % 2 ? 2 : 1.2)}px` }}
              />
            ))}
          </div>
        </div>
        <p className="text-center text-[30px] font-light tabular-nums">{recording || voiceFile ? time : '00:30'}</p>
        <div className="mt-4 h-1.5 rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${Math.min(100, Math.max(8, (recordingSeconds / 30) * 100))}%` }}
          />
        </div>

        {recording ? (
          <div className="mt-7 grid grid-cols-2 gap-2">
            <Button
              onClick={recordingPaused ? resumeRecording : pauseRecording}
              className="h-16 rounded-full bg-white/12 text-[17px] font-black text-white shadow-none ring-1 ring-white/30 hover:bg-white/20"
            >
              {recordingPaused ? (
                <>
                  <Mic className="mr-2 h-4 w-4" />
                  계속 녹음
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
              className="h-16 rounded-full bg-white text-[17px] font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              녹음 끝내기
            </Button>
          </div>
        ) : (
          <Button
            onClick={startRecording}
            className="mt-7 h-16 w-full rounded-full bg-white text-[18px] font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
          >
            <Mic className="mr-2 h-5 w-5" />
            내 목소리 녹음
          </Button>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="h-14 flex-1 rounded-full border-white/30 bg-white/10 text-[17px] font-black text-white shadow-none hover:bg-white/20"
            onClick={openVoiceFileSearch}
            disabled={recording}
          >
            <FileAudio className="mr-2 h-5 w-5" />
            파일 선택
          </Button>
          {voiceFile && (
            <Button
              onClick={() => handleUpload()}
              disabled={uploading || recording || Boolean(fileId)}
              className="h-14 rounded-full bg-white px-5 text-[17px] font-black text-[#0d777c] shadow-none hover:bg-[#eef8f6]"
            >
              {fileId ? '확인 완료' : uploading ? '확인 중' : '품질 확인'}
            </Button>
          )}
        </div>

        {voiceFile && voiceDownloadUrl && (
          <a
            href={voiceDownloadUrl}
            download={voiceFile.name}
            onClick={() => {
              setDownloadStatus('저장 요청을 보냈습니다. 다운로드 폴더 또는 브라우저 다운로드 목록에서 파일을 확인해 주세요.')
            }}
            className="mt-3 flex h-14 w-full items-center justify-center rounded-full border border-white/25 bg-white/10 text-[16px] font-black text-white hover:bg-white/20"
          >
            <Download className="mr-2 h-5 w-5" />
            내 기기에 저장하기
          </a>
        )}
        {downloadStatus && (
          <p className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-center text-[15px] font-bold leading-6 text-white">
            {downloadStatus}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[#dce9e6] bg-white p-4">
        {voiceFile && (
          <div className="mb-4 rounded-2xl bg-[#f1f8f6] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0f7d82] text-white">
                <Music className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-black text-[#183f40]">{voiceFile.name}</p>
                <p className="text-[13px] font-semibold text-[#6f8785]">{(voiceFile.size / 1024 / 1024).toFixed(1)}MB</p>
              </div>
              <button onClick={clearVoiceFile} className="text-[#7d9593]">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {quality && (
          <div className={`rounded-2xl p-4 ${quality.quality_pass ? 'bg-[#edf8f4]' : 'bg-red-50'}`}>
            <p className={`text-[16px] font-black ${quality.quality_pass ? 'text-[#0f7d82]' : 'text-red-600'}`}>
              {quality.quality_pass ? '품질 검증 통과' : '품질 검증 실패'}
            </p>
            <p className="mt-2 text-[14px] font-semibold leading-6 text-[#6f8785]">
              길이 {quality.duration_seconds.toFixed(1)}초 · SNR {quality.snr_db.toFixed(1)}dB · 무음 {(quality.silence_ratio * 100).toFixed(1)}%
            </p>
            {quality.rejection_reason && <p className="mt-2 text-[14px] font-semibold leading-6 text-red-600">{quality.rejection_reason}</p>}
          </div>
        )}
        {uploadStatus && (
          <p className="mt-3 rounded-xl bg-[#eef7fb] px-4 py-3 text-center text-[15px] font-bold leading-6 text-[#426160]">
            {uploadStatus}
          </p>
        )}

        <input
          ref={voiceInputRef}
          type="file"
          accept={audioInputAccept}
          className="hidden"
          onClick={e => {
            e.currentTarget.value = ''
          }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) {
              setCurrentVoiceFile(file)
              void handleUpload(file)
            }
          }}
        />
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-[15px] font-bold leading-6 text-red-600">{error}</p>}

      <Button
        onClick={() => onComplete(fileId, quality?.duration_seconds || recordingSeconds || 0)}
        disabled={!canProceed}
        className="h-16 w-full rounded-full bg-[#0f7d82] text-[18px] font-black text-white shadow-none hover:bg-[#0b6f74]"
      >
        분석 시작
      </Button>

      <p className="flex items-center justify-center gap-1 text-[14px] font-semibold leading-5 text-[#8aa09e]">
        <CheckCircle className="h-4 w-4 shrink-0" />
        의료 진단이 아닌 비의료적 참고 정보로 결과를 제공합니다.
      </p>
    </div>
  )
}
