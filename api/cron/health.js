// 비활성화됨 — 크론이 호출해도 아무것도 안 함
export default async function handler(req, res) {
  return res.status(200).json({ disabled: true });
}
