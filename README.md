# İstanbul Havalimanı Metrosu (M11) — Süre, Ücret & Sefer Saatleri

M11 metro hattında (Gayrettepe · İstanbul Havalimanı · Halkalı) iki istasyon arası
**süre, mesafe, istasyon sayısı ve güncel 2026 ücretini** hesaplayan tek sayfalık,
bağımlılıksız statik site. GitHub Pages ile yayınlanır.

## Yapı
- `index.html` — yayınlanan sayfa (tüm CSS/JS gömülü, statik)
- `robots.txt`, `sitemap.xml` — SEO
- `worker.js` — kaynak (Cloudflare Worker biçimi); `index.html` bundan üretilir

## Güncelleme
`worker.js` içindeki veriyi düzenledikten sonra statik dosyaları yeniden üret:
```bash
cp worker.js worker.mjs
node -e "import('./worker.mjs').then(async m=>{const r=await m.default.fetch(new Request('https://istanbul-havalimani-metro.github.io/'));require('fs').writeFileSync('index.html',await r.text())})"
```

## Veri kaynakları
Süreler TCDD son tren tarifesinden; ücretler İBB/UKOME 16.02.2026 tarifesinden türetilmiştir. Gayriresmîdir.
