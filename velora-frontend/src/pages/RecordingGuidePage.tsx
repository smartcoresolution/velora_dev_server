import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, MessageCircle, ShieldCheck, UserRoundCheck, X } from 'lucide-react'

const goodPhrases = [
  '천천히 말씀해 주세요.',
  '생각나는 데까지 말씀하시면 돼요.',
  '그다음에는 무엇을 하셨어요?',
  '잠깐 쉬었다가 이어서 말씀해 주세요.',
]

const avoidPhrases = [
  '아까 말했잖아요.',
  '왜 기억을 못 하세요?',
  '정확히 대답해 보세요.',
  '틀렸어요. 다시 말해보세요.',
]

const topicCards = [
  {
    title: '장보기와 저녁 준비',
    question: '오늘 저녁은 뭐 드실 거예요? 마트에 가면 무엇을 사야 할까요?',
    points: '물건 기억, 순서 설명, 단어 선택',
    example: {
      title: '장보기와 저녁 준비 대화 예시',
      context: '자녀가 부모님께 오늘 저녁 메뉴와 장볼 물건을 자연스럽게 묻는 전화통화입니다.',
      duration: '약 1분 ~ 1분 30초',
      lines: [
        ['자녀', '엄마, 오늘 저녁에는 뭐 드실 생각이세요?'],
        ['부모', '오늘은 된장찌개를 끓여 먹으려고 해. 냉장고를 보니까 두부는 조금 남아 있는데, 애호박하고 버섯이 없더라. 그래서 오후에 마트에 가서 애호박, 버섯, 계란을 사오려고 해.'],
        ['자녀', '그럼 장볼 건 애호박, 버섯, 계란이네요?'],
        ['부모', '응, 맞아. 그리고 우유도 거의 떨어졌으니까 우유도 하나 사면 좋겠어. 우유는 무거우니까 작은 걸로 하나만 사려고 해.'],
        ['자녀', '마트에 가시면 어떤 순서로 보실 거예요?'],
        ['부모', '먼저 채소 코너에서 애호박하고 버섯을 고르고, 그다음에 계란을 보고, 마지막에 우유를 사면 될 것 같아. 집에 오면 바로 찌개를 끓이고 남은 반찬하고 같이 먹으면 되지.'],
        ['자녀', '아까 말씀하신 장볼 물건을 다시 한번 말해주실 수 있어요?'],
        ['부모', '애호박, 버섯, 계란, 그리고 우유였지. 이렇게 적어두면 빠뜨리지 않을 것 같아.'],
        ['자녀', '네, 다녀오실 때 천천히 다녀오세요.'],
        ['부모', '그래. 마트 다녀와서 전화할게.'],
      ],
    },
  },
  {
    title: '병원 예약과 약 복용',
    question: '이번 주 병원 예약이 언제였죠? 약은 드셨어요?',
    points: '시간 기억, 일정 회상, 준비물 계획',
    example: {
      title: '병원 예약과 약 복용 통화 예시',
      context: '자녀가 부모님께 병원 예약, 출발 시간, 약 복용 여부, 준비물을 자연스럽게 확인하는 전화통화입니다.',
      duration: '약 1분 ~ 1분 30초',
      lines: [
        ['자녀', '아버지, 이번 주 병원 예약이 언제였죠?'],
        ['부모', '병원 예약이... 이번 주 금요일이었던 것 같아. 잠깐만, 달력에 적어둔 걸 보면 정확한데. 여기 보니까 금요일 오전 열 시 반이네. 내가 아까는 목요일인가 했는데, 금요일이 맞아.'],
        ['자녀', '그럼 몇 시쯤 집에서 나가시면 좋을까요?'],
        ['부모', '열 시 반 예약이면 아홉 시 반쯤 나가면 될 것 같아. 버스를 타면 한 번에 가는데 기다리는 시간이 있을 수 있으니까 조금 일찍 나가는 게 좋겠지.'],
        ['자녀', '오늘 아침 약은 드셨어요?'],
        ['부모', '먹은 것 같아. 아침 먹고 물컵을 식탁에 놨던 기억이 나거든. 그런데 표시를 했는지는 잘 모르겠네. 요즘은 약 먹고 나면 달력에 표시하려고 하는데 가끔 잊어버려.'],
        ['자녀', '그럼 약 봉투를 한번 확인해 보시면 되겠네요.'],
        ['부모', '응, 약 봉투를 보면 알 수 있어. 아침 약 봉지가 비어 있으면 먹은 거니까. 이렇게 확인하면 마음이 좀 놓여.'],
        ['자녀', '병원 갈 때 챙길 것은 뭐가 있을까요?'],
        ['부모', '신분증하고 검사 결과지, 약 봉투. 그리고 예약 시간은 금요일 오전 열 시 반. 내가 냉장고 옆에 크게 적어둘게.'],
        ['자녀', '네, 전날 다시 한번 전화드릴게요.'],
        ['부모', '그래, 그렇게 해주면 고맙지. 다녀와서 연락할게.'],
      ],
    },
  },
  {
    title: '오늘 하루와 현재 상황',
    question: '오늘 하루 어떻게 보내셨어요? 식사는 하셨어요?',
    points: '최근 기억, 현재 인식, 대화 유지',
    example: {
      title: '오늘 하루와 현재 상황 통화 예시',
      context: '자녀가 부모님께 오늘 하루, 식사 여부, 현재 위치, 내일 일정을 자연스럽게 확인하는 전화통화입니다.',
      duration: '약 1분 ~ 1분 30초',
      lines: [
        ['자녀', '엄마, 오늘 하루 어떻게 보내셨어요?'],
        ['부모', '아침에 일어나서 물을 한 잔 마시고 창밖을 봤어. 날씨가 괜찮아서 빨래를 돌렸던 것 같아. 그리고 잠깐 밖에 나갔다 온 것 같은데, 마트였는지 은행이었는지 조금 헷갈리네. 아마 마트에 다녀온 것 같아. 장바구니가 현관에 있으니까.'],
        ['자녀', '마트에서는 뭐 사셨어요?'],
        ['부모', '계란하고 두부를 산 것 같아. 우유도 사려고 했는데 샀는지는 잘 모르겠네. 냉장고를 보면 알 수 있을 것 같아. 요즘은 장볼 것을 적어두지 않으면 하나씩 빠뜨릴 때가 있어서 휴대폰에 메모해 두려고 해.'],
        ['자녀', '식사는 하셨어요?'],
        ['부모', '점심은 먹었어. 밥하고 김치, 그리고 남은 국을 데워 먹었어. 그런데 저녁은 아직 안 먹은 것 같아. 조금 전에 뭘 먹은 것 같기도 한데 정확히는 모르겠네. 식탁을 보면 알 수 있을 것 같아.'],
        ['자녀', '지금은 집에 계신 거죠?'],
        ['부모', '응, 집에 있어. 현관 옆에 장바구니도 있고, 거실에 앉아 있어. 그런데 오늘이 수요일인지 목요일인지 잠깐 헷갈리네. 달력을 한번 봐야겠다.'],
        ['자녀', '괜찮아요. 천천히 확인하시면 돼요. 내일은 어떤 일정이 있으세요?'],
        ['부모', '내일은 특별한 일정은 없고, 오전에 산책을 조금 하려고 해. 그리고 우유를 안 샀으면 마트에 다시 다녀와야지.'],
      ],
    },
  },
]

export default function RecordingGuidePage() {
  const [openExample, setOpenExample] = useState<(typeof topicCards)[number]['example'] | null>(null)

  return (
    <div className="space-y-4 pt-2">
      <section className="rounded-[24px] border border-[#dce9e6] bg-white p-4 shadow-sm shadow-teal-950/5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-[#0f7d82]" />
          <p className="text-[17px] font-black text-[#183f40]">기본 원칙</p>
        </div>
        <div className="mt-3 space-y-1.5">
          {[
            '녹음 길이는 1분 ~ 1분 30초로 해주세요.',
            '검사처럼 묻지 말고 평소 전화하듯이 대화합니다.',
            '자녀는 짧게 묻고 부모님이 충분히 말할 수 있게 기다립니다.',
            '부모님이 헷갈리거나 멈추더라도 바로 정정하지 않습니다.',
            '분석 결과는 진단명이 아닌 참고 신호로만 사용합니다.',
          ].map(item => (
            <p key={item} className="rounded-xl bg-[#f7fbfa] px-3 py-2 text-[15px] font-bold leading-[1.42] text-[#426160]">
              {item}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#dce9e6] bg-white p-4 shadow-sm shadow-teal-950/5">
        <div className="flex items-center gap-2">
          <UserRoundCheck className="h-6 w-6 text-[#0f7d82]" />
          <p className="text-[17px] font-black text-[#183f40]">자녀 진행법</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-[#eef8f4] p-3">
            <p className="text-[14px] font-black text-[#168462]">권장 표현</p>
            <div className="mt-2 space-y-1.5">
              {goodPhrases.map(phrase => (
                <p key={phrase} className="text-[14px] font-bold leading-[1.42] text-[#315d52]">{phrase}</p>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-[#fff4f1] p-3">
            <p className="text-[14px] font-black text-[#d45a38]">피해야 할 표현</p>
            <div className="mt-2 space-y-1.5">
              {avoidPhrases.map(phrase => (
                <p key={phrase} className="text-[14px] font-bold leading-[1.42] text-[#7b5148]">{phrase}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <MessageCircle className="h-6 w-6 text-[#0f7d82]" />
          <p className="text-[17px] font-black text-[#183f40]">전화 대화 주제</p>
        </div>
        {topicCards.map(topic => (
          <button
            key={topic.title}
            onClick={() => topic.example && setOpenExample(topic.example)}
            className="w-full rounded-[22px] border border-[#e3ece9] bg-white p-4 text-left shadow-sm shadow-teal-950/5"
            aria-label={topic.example ? `${topic.title} 대화 예시 보기` : topic.title}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[16px] font-black text-[#183f40]">{topic.title}</p>
                <p className="mt-2 text-[15px] font-bold leading-[1.42] text-[#426160]">{topic.question}</p>
              </div>
              {topic.example && <ChevronRight className="mt-0.5 h-6 w-6 shrink-0 text-[#8aa09e]" />}
            </div>
            <p className="mt-2 rounded-xl bg-[#f7fbfa] px-3 py-2 text-[14px] font-bold leading-[1.42] text-[#6f8785]">{topic.points}</p>
            {topic.example && <p className="mt-2 text-[14px] font-black text-[#0f7d82]">대화 예시 보기</p>}
          </button>
        ))}
      </section>

      <section className="rounded-[24px] border border-[#ffd7cd] bg-[#fff7f4] p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[#d45a38]" />
          <div>
            <p className="text-[16px] font-black text-[#7b3c2c]">녹음 전 고지</p>
            <p className="mt-1 text-[15px] font-bold leading-[1.42] text-[#7b5148]">
              이 녹음은 의료 진단을 대체하지 않습니다. 음성 분석 결과는 인지기능 변화와 관련될 수 있는 참고 정보이며,
              치매 또는 경도인지장애 여부를 확정하지 않습니다.
            </p>
          </div>
        </div>
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-[#f7fbfa] px-4 py-3 text-[14px] font-semibold leading-[1.42] text-[#7d9593]">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0f7d82]" />
        걱정되는 변화가 지속되면 치매안심센터, 병원, 전문 의료진과 상담해 주세요.
      </p>

      {openExample && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3" onClick={() => setOpenExample(null)}>
          <section
            className="max-h-[82vh] w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-[#fbfdfb] shadow-2xl shadow-black/20"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#e3ece9] px-5 py-4">
              <div>
                <p className="text-[18px] font-black text-[#183f40]">{openExample.title}</p>
                <p className="mt-2 text-[14px] font-semibold leading-[1.42] text-[#607b79]">상황: {openExample.context}</p>
                <p className="mt-1 text-[14px] font-semibold leading-[1.42] text-[#607b79]">목표 시간: {openExample.duration}</p>
              </div>
              <button
                onClick={() => setOpenExample(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#0f7d82] hover:bg-[#e8f3f1]"
                aria-label="예시 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[62vh] space-y-2 overflow-y-auto px-5 py-4">
              {openExample.lines.map(([speaker, text], index) => (
                <div key={`${speaker}-${index}`} className="rounded-xl bg-[#f1f8f6] px-3 py-2">
                  <p className="text-[13px] font-black text-[#0f7d82]">{speaker}</p>
                  <p className="mt-1 text-[15px] font-bold leading-[1.42] text-[#315d52]">{text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
