import crypto from 'crypto';

// ============================================================
// 바른길 서버 외부감시 크론 (Vercel Cron)
// ============================================================
// 역할: EC2 서버가 완전히 죽었을 때 SMS 알림 발송
//       (내부 워치독은 EC2와 함께 죽으므로 외부 감시 필요)
//
// 판정 기준: HTTP 200 응답 = UP (JSON 파싱 불필요)
//           그 외 = 3회 재시도 후 DOWN 판정
//
// 알림 형식: "[외부감시] 바른길 서버 다운"
// 내부 워치독: "🚨 바른길 서버 다운" (deploy/watchdog.py)
// ============================================================

const HEALTH_URL = 'https://doc.brg-law.com/health';
const DIAG_URL = 'https://doc.brg-law.com/diag';
const SOLAPI_API_KEY = 'NCSPP9ZYSM2HQH6F';
const SOLAPI_API_SECRET = 'AOKYAN62JKL7LMTP0CZOHYLWFG8XSOTA';
const SOLAPI_SENDER = '025399892';
const ALERT_PHONE = '01099187093';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkHealthOnce() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const start = Date.now();
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;

    // HTTP 200~299 = 서버 살아있음. JSON 파싱 실패해도 UP 처리.
    if (res.ok) {
      return { ok: true, status: res.status, elapsed };
    }
    return { ok: false, status: res.status, elapsed, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, status: 0, elapsed: 0, error: e.message };
  }
}

async function checkHealthWithRetry() {
  const attempts = [];

  for (let i = 0; i < MAX_RETRIES; i++) {
    const result = await checkHealthOnce();
    attempts.push({ attempt: i + 1, ...result });

    if (result.ok) {
      return { ok: true, attempts };
    }

    if (i < MAX_RETRIES - 1) {
      await sleep(RETRY_DELAY_MS);
    }
  }

  return { ok: false, attempts };
}

async function sendSMS(text) {
  const ts = new Date().toISOString().replace(/\.\d+Z/, '.000Z');
  const salt = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  const sig = crypto.createHmac('sha256', SOLAPI_API_SECRET)
    .update(ts + salt).digest('hex');

  const message = {
    to: ALERT_PHONE,
    from: SOLAPI_SENDER,
    text,
    type: 'LMS',
    subject: '[바른길 서버알림]'
  };

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Authorization': `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${ts}, salt=${salt}, signature=${sig}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

export default async function handler(req, res) {
  const result = await checkHealthWithRetry();
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const lastAttempt = result.attempts[result.attempts.length - 1];

  if (!result.ok) {
    const errorDetail = lastAttempt.error || '응답 없음';
    await sendSMS(
      `[외부감시] 바른길 서버 다운\n시각: ${now}\nHTTP: ${lastAttempt.status}\n오류: ${errorDetail}\n재시도: ${result.attempts.length}회 전부 실패\n${DIAG_URL}`
    );
  }

  return res.status(200).json({
    checked_at: now,
    server: result.ok ? 'UP' : 'DOWN',
    retries: result.attempts.length,
    attempts: result.attempts,
    alert_sent: !result.ok
  });
}
