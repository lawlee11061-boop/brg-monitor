# brg-monitor — 바른길 서버 외부감시

## 뭐하는 앱인가?

EC2 서버(doc.brg-law.com)가 **완전히 죽었을 때** SMS 알림을 보내는 외부 감시 시스템.

EC2 내부에 워치독(`deploy/watchdog.py`)이 있지만, EC2 자체가 죽으면 워치독도 같이 죽어서 알림을 못 보낸다.
그래서 Vercel(외부)에서 EC2를 감시하는 이 앱이 필요하다.

## 알림 체계 (2개 독립 운영)

| 시스템 | 위치 | 알림 형식 | 역할 |
|--------|------|----------|------|
| 내부 워치독 | EC2 `deploy/watchdog.py` | 🚨 바른길 서버 다운 | 앱 프로세스 감시 + 자동 재시작 |
| **이 앱 (외부감시)** | Vercel `brg-monitor` | [외부감시] 바른길 서버 다운 | EC2 전체 다운 감지 |

## 구조

```
brg-monitor/
├── api/
│   ├── cron/
│   │   └── health.js    ← Vercel Cron으로 매일 실행, 3회 재시도 후 SMS
│   └── status.js        ← /api/status — 현재 서버 상태 JSON 반환
├── public/
│   └── index.html       ← brg-monitor.vercel.app 대시보드 UI
├── vercel.json           ← 크론 스케줄 설정
└── package.json
```

## 핵심 설정

- **체크 URL**: `https://doc.brg-law.com/health`
- **크론 스케줄**: `0 0 * * *` (매일 UTC 00:00 = KST 09:00)
- **재시도**: 3회, 5초 간격 (오탐 방지)
- **SMS 발송**: Solapi (02-539-9892 → 010-9918-7093)
- **Vercel 플랜**: Hobby (크론 하루 1회 제한)

## 문제 해결

### "서버 정상인데 [외부감시] 알림이 온다"

1. Vercel↔EC2 간 일시적 네트워크 지연 → 3회 재시도로 대부분 해결됨
2. EC2 배포(restart) 중 타이밍 겹침 → 크론 시간 변경 검토
3. `/health` 엔드포인트 변경됐는지 확인: `curl https://doc.brg-law.com/health`

### 크론 실행 확인

Vercel 대시보드 → brg-monitor → Logs → Runtime Logs

### SMS 발송 확인

Solapi 대시보드 → 메시지 로그 (console.solapi.com/message-log)

## 관련 프로젝트

- `doc-generator` — 메인 서버 (Flask, EC2)
- `doc-generator/deploy/watchdog.py` — 내부 워치독
- `doc-generator/deploy/webhook.py` — GitHub 자동배포

## 변경 이력

- 2026-02-24: 오탐 방지 (3회 재시도 + 5초 간격 + 타임아웃 15초)
- 2026-02-24: README 추가
- 2026-02-24: 크론 5분 → 하루1회 (Vercel Hobby 제한)
- 2026-02-23: 초기 생성

