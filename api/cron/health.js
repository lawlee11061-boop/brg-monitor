import crypto from 'crypto';

const HEALTH_URL = 'https://doc.brg-law.com/health';
const SOLAPI_API_KEY = 'NCSPP9ZYSM2HQH6F';
const SOLAPI_API_SECRET = 'AOKYAN62JKL7LMTP0CZOHYLWFG8XSOTA';
const SOLAPI_SENDER = '025399892';
const ALERT_PHONE = '01099187093';
const ALERT_EMAIL = 'eslee@brg-law.com';

async function checkHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return { ok: data.status === 'ok', status: res.status, ts: data.ts };
    }
    return { ok: false, status: res.status, ts: null };
  } catch (e) {
    return { ok: false, status: 0, error: e.message, ts: null };
  }
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
  const result = await checkHealth();
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  if (!result.ok) {
    // 서버 다운 — SMS 발송
    await sendSMS(
      `🚨 [외부감시] 바른길 서버 다운\n시각: ${now}\nHTTP: ${result.status}\n오류: ${result.error || '응답 없음'}\nhttps://doc.brg-law.com/diag`
    );
  }

  return res.status(200).json({
    checked_at: now,
    server: result.ok ? 'UP' : 'DOWN',
    http_status: result.status,
    error: result.error || null,
    alert_sent: !result.ok
  });
}
