// خادم الوسيط لتطبيق سحّاب — يعمل على Cloudflare Workers مجاناً.
// وظيفته: يجلب الملف من الموقع الأصلي ويمرره للتطبيق مع السماح بالقراءة (CORS)
// ويمرر طلبات التقسيم (Range) كما هي، فيعمل التنزيل بعدة اتصالات.
//
// اختياري: لمنع الآخرين من استعمال خادمك، أضف متغيراً سرياً باسم KEY
// من إعدادات العامل، واكتب القيمة نفسها في خانة «مفتاح الوسيط» في التطبيق.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Content-Disposition, Content-Type, Accept-Ranges, X-Final-Url',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET' && request.method !== 'HEAD') return text('طريقة غير مسموحة', 405);

    const params = new URL(request.url).searchParams;
    const target = params.get('url');
    if (!target) return text('سحّاب: خادم الوسيط يعمل.', 200);
    if (env.KEY && params.get('key') !== env.KEY) return text('مفتاح غير صحيح', 403);

    let u;
    try { u = new URL(target); } catch { return text('رابط غير صالح', 400); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return text('رابط غير صالح', 400);

    const headers = new Headers();
    const range = request.headers.get('Range');
    if (range) headers.set('Range', range);
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36');
    headers.set('Accept', '*/*');
    headers.set('Referer', u.origin + '/');

    let res;
    try {
      res = await fetch(u.href, { method: request.method, headers, redirect: 'follow' });
    } catch (e) {
      return text('تعذّر الوصول إلى الموقع: ' + e.message, 502);
    }

    const out = new Headers();
    for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'Content-Disposition', 'Accept-Ranges', 'Last-Modified', 'ETag']) {
      const v = res.headers.get(h); if (v) out.set(h, v);
    }
    for (const [k, v] of Object.entries(CORS)) out.set(k, v);
    out.set('X-Final-Url', res.url || u.href);
    out.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, headers: out });
  }
};

function text(t, status) {
  return new Response(t, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS } });
}
