export default async function handler(req, res) {
  const HEALTH_URL = 'https://doc.brg-law.com/health';
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  
  let serverStatus = 'UNKNOWN';
  let serverTs = null;
  let httpStatus = 0;
  let responseTime = 0;

  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(HEALTH_URL, { signal: controller.signal });
    clearTimeout(timeout);
    responseTime = Date.now() - start;
    httpStatus = response.status;
    
    if (response.ok) {
      const data = await response.json();
      serverStatus = ['ok','healthy','degraded'].includes(data.status) ? 'UP' : 'DOWN';
      serverTs = data.ts;
    } else {
      serverStatus = 'DOWN';
    }
  } catch (e) {
    serverStatus = 'DOWN';
  }

  return res.status(200).json({
    service: '바른길 문서자동화',
    url: 'https://doc.brg-law.com',
    status: serverStatus,
    http_status: httpStatus,
    response_time_ms: responseTime,
    server_ts: serverTs,
    checked_at: now
  });
}
