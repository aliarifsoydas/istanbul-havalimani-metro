// ============================================================================
// M11 Metro — Süre & Ücret Hesaplayıcı  (tek dosyalık Cloudflare Worker)
// Gayrettepe · İstanbul Havalimanı · Halkalı
//
// Veri kaynakları:
//  - Süreler: TCDD "son tren" tarifesi (istasyon geçiş saatlerinden türetilmiş)
//  - Ücretler: İBB/UKOME 16.02.2026 tarifesi (resmî, 7 kademe)
//  - İstasyon/aktarma/ilçe: TCDD & Vikipedi
// Bu araç gayriresmîdir; ücret ve saatler değişebilir.
//
// >>> YAYINLAMADAN ÖNCE: SITE değerini kendi alan adınla değiştir. <<<
// ============================================================================

const SITE = "https://istanbul-havalimani-metro.github.io"; // yayın adresi

// --- İstasyonlar (Terminal 2 kapalı olduğu için listede yok) --------------
// tH: Halkalı yönünde Gayrettepe'den itibaren dakika (son tren)
// tG: Gayrettepe yönünde Halkalı'dan itibaren dakika (son tren)
const S = [
  { name: "Gayrettepe", ilce: "Şişli", near: "Zorlu Center · Zincirlikuyu", km: 0.00, tH: 0, tG: 63, fH: "05:55", lH: "23:55", fG: "06:03", lG: "00:47", akt: "M2, Metrobüs" },
  { name: "Kâğıthane", ilce: "Kâğıthane", near: "Kâğıthane Deresi", km: 3.94, tH: 4, tG: 60, fH: "05:59", lH: "23:59", fG: "06:00", lG: "00:44", akt: "M7" },
  { name: "Hasdal", ilce: "Eyüpsultan", near: "Çapa Tıp Fak. Hastanesi", km: 9.43, tH: 9, tG: 55, fH: "06:04", lH: "00:04", fG: "06:10", lG: "00:39", akt: "—" },
  { name: "Kemerburgaz", ilce: "Eyüpsultan", near: "Kemerburgaz Kent Ormanı", km: 15.03, tH: 13, tG: 50, fH: "06:09", lH: "00:08", fG: "06:05", lG: "00:34", akt: "—" },
  { name: "Göktürk", ilce: "Eyüpsultan", near: "Göktürk merkez", km: 18.16, tH: 17, tG: 47, fH: "05:57", lH: "00:12", fG: "06:02", lG: "00:31", akt: "—" },
  { name: "İhsaniye", ilce: "Eyüpsultan", near: "İhsaniye", km: 28.11, tH: 24, tG: 39, fH: "06:05", lH: "00:19", fG: "06:09", lG: "00:23", akt: "—" },
  { name: "İstanbul Havalimanı", ilce: "Arnavutköy", near: "İGA Terminal", km: 34.10, tH: 30, tG: 33, fH: "06:11", lH: "00:25", fG: "06:03", lG: "00:17", akt: "YHT (yakında)" },
  { name: "Kargo Terminali", ilce: "Arnavutköy", near: "THY Kargo / İGA", km: 36.61, tH: 34, tG: 31, fH: "06:14", lH: "00:29", fG: "06:00", lG: "00:15", akt: "—" },
  { name: "Taşoluk", ilce: "Arnavutköy", near: "Depo sahası", km: 43.01, tH: 39, tG: 25, fH: "06:04", lH: "00:34", fG: "06:10", lG: "00:09", akt: "—" },
  { name: "Arnavutköy Hastane", ilce: "Arnavutköy", near: "Arnavutköy Devlet Hastanesi", km: 47.34, tH: 43, tG: 21, fH: "06:08", lH: "00:38", fG: "06:06", lG: "00:05", akt: "—" },
  { name: "İbn Haldun Üniversitesi", ilce: "Başakşehir", near: "İbn Haldun Üniversitesi", km: 54.24, tH: 49, tG: 15, fH: "06:14", lH: "00:44", fG: "06:00", lG: "23:59", akt: "—" },
  { name: "Kayaşehir", ilce: "Başakşehir", near: "Başakşehir Millet Bahçesi", km: 58.05, tH: 52, tG: 12, fH: "06:03", lH: "00:47", fG: "05:56", lG: "23:56", akt: "M3" },
  { name: "Olimpiyatköy", ilce: "Başakşehir", near: "Atatürk Olimpiyat Stadyumu", km: 62.48, tH: 57, tG: 7, fH: "06:07", lH: "00:52", fG: "06:07", lG: "23:51", akt: "M9" },
  { name: "Halkalı Stadı", ilce: "Küçükçekmece", near: "İBB Halkalı Futbol Stadı", km: 64.95, tH: 60, tG: 4, fH: "06:10", lH: "00:55", fG: "06:04", lG: "23:48", akt: "M7 (Atakent)" },
  { name: "Halkalı", ilce: "Küçükçekmece", near: "Halkalı Marmaray / YHT Garı", km: 69.11, tH: 64, tG: 0, fH: "06:15", lH: "00:59", fG: "06:00", lG: "23:44", akt: "Marmaray, M1, YHT" },
];

// --- Ücret kademeleri (İBB/UKOME 16.02.2026; istasyon sayısı = uçtan uca dahil)
const FARE = [
  { maxN: 3, tam: 34.00, ogr: 16.48, sos: 24.16 },
  { maxN: 6, tam: 38.49, ogr: 18.91, sos: 27.68 },
  { maxN: 8, tam: 43.54, ogr: 21.26, sos: 31.05 },
  { maxN: 10, tam: 48.85, ogr: 23.61, sos: 34.43 },
  { maxN: 12, tam: 54.45, ogr: 25.95, sos: 37.80 },
  { maxN: 14, tam: 60.35, ogr: 28.30, sos: 41.18 },
  { maxN: 16, tam: 66.54, ogr: 30.65, sos: 44.55 },
];
const FREE = [10, 11, 12, 13, 14]; // 31 Tem 2026'ya kadar biniş ücretsiz istasyonlar

// --- Yardımcılar (sunucu tarafı: SEO içerikleri önceden hesaplamak için) ----
function lira(v) { return "₺" + v.toFixed(2).replace(".", ","); }
function fareFor(n) { for (const f of FARE) if (n <= f.maxN) return f; return FARE[FARE.length - 1]; }
function tripTime(i, j) { return j > i ? (S[j].tH - S[i].tH) : (S[j].tG - S[i].tG); }
function tripDir(i, j) { return j > i ? "Halkalı yönü" : "Gayrettepe yönü"; }

// --- Sık aranan güzergâhlar (SEO) ------------------------------------------
const POPULAR = [[0, 6], [14, 6], [1, 6], [0, 14]].map(([i, j]) => {
  const n = Math.abs(i - j) + 1;
  return { i, j, time: tripTime(i, j), n, fare: fareFor(n).tam };
});

// --- SSS (hem görünür HTML hem JSON-LD için tek kaynak) --------------------
const FAQ = [
  { q: "Gayrettepe'den İstanbul Havalimanı'na metro kaç dakika?",
    a: "M11 ile Gayrettepe'den İstanbul Havalimanı'na yaklaşık 30 dakikada, 7 istasyonda ulaşılır. Tam ücret 43,54 TL'dir." },
  { q: "Halkalı'dan İstanbul Havalimanı'na kaç dakika?",
    a: "Halkalı'dan İstanbul Havalimanı'na M11 ile yaklaşık 33 dakika sürer ve 9 istasyon geçilir. Tam ücret 48,85 TL'dir." },
  { q: "M11 metro ücreti ne kadar? (2026)",
    a: "16 Şubat 2026 tarifesine göre ücret istasyon sayısına göre 34,00 TL ile 66,54 TL (tam) arasında değişir. Girişte en yüksek ücret alınır, çıkışta gidilmeyen mesafe iade edilir." },
  { q: "M11 kaç dakikada bir geçiyor?",
    a: "Gündüz seferleri yaklaşık 15-20 dakikada birdir. Cuma ve Cumartesi geceleri 00:01-05:30 arasında 30 dakikada bir ek sefer yapılır; gece seferlerinde çift ücret uygulanır." },
  { q: "M11 ilk ve son sefer saatleri nedir?",
    a: "Seferler yaklaşık 06:00'da başlar. Son tren Gayrettepe'den 23:55'te kalkıp Halkalı'ya 00:59'da varır; Halkalı'dan son tren 23:44'te kalkar." },
  { q: "Halkalı - İstanbul Havalimanı metrosu ücretsiz mi?",
    a: "31 Temmuz 2026 tarihine kadar İbn Haldun Üniversitesi, Kayaşehir, Olimpiyatköy, Halkalı Stadı ve Halkalı istasyonlarından biniş ücretsizdir; diğer istasyonlardan biniş ücretlidir." },
  { q: "M11 hangi hatlara aktarma yapıyor?",
    a: "Gayrettepe'de M2 ve Metrobüs, Kâğıthane'de M7, Kayaşehir'de M3, Olimpiyatköy'de M9, Halkalı'da Marmaray, M1 ve Yüksek Hızlı Tren aktarması yapılabilir." },
];

// --- HTML parçaları (sunucu tarafında üretilir) ----------------------------
const opts = (sel) => S.map((s, i) => "<option value=\"" + i + "\"" + (i === sel ? " selected" : "") + ">" + s.name + "</option>").join("");

const popularHTML = POPULAR.map(p =>
  "<button class=\"jump\" type=\"button\" data-from=\"" + p.i + "\" data-to=\"" + p.j + "\">" +
  "<span class=\"j-od\">" + S[p.i].name + "<i>→</i>" + S[p.j].name + "</span>" +
  "<span class=\"j-meta\"><b>" + p.time + " dk</b><em>" + p.n + " istasyon</em><em>" + lira(p.fare) + "</em></span>" +
  "<span class=\"j-go\">→</span>" +
  "</button>"
).join("");

// Dokunmatik hat şeridi — her istasyon bir düğüm, aktarma olanlar halka
const railHTML = S.map((s, i) =>
  "<button class=\"node\" type=\"button\" data-idx=\"" + i + "\"" + (s.akt !== "—" ? " data-t=\"1\"" : "") + " aria-label=\"" + s.name + "\">" +
  "<span class=\"dot\"></span>" +
  "<span class=\"pin\"></span>" +
  "<span class=\"nlabel\">" + s.name + "</span>" +
  "</button>"
).join("");

const stationRows = S.map((s, i) =>
  "<tr>" +
  "<td class=\"st-name\"><b>" + s.name + "</b><span>" + s.near + "</span></td>" +
  "<td>" + s.ilce + "</td>" +
  "<td>" + s.akt + "</td>" +
  "<td class=\"nowrap\">" + s.fH + " – " + s.lH + "</td>" +
  "<td class=\"nowrap\">" + s.fG + " – " + s.lG + "</td>" +
  "</tr>"
).join("");

const fareRows = FARE.map((f, k) => {
  const lo = k === 0 ? 1 : FARE[k - 1].maxN + 1;
  return "<tr><td>" + lo + "–" + f.maxN + " istasyon</td><td>" + lira(f.tam) + "</td><td>" + lira(f.ogr) + "</td><td>" + lira(f.sos) + "</td></tr>";
}).join("");

const faqHTML = FAQ.map(f =>
  "<details><summary>" + f.q + "</summary><p>" + f.a + "</p></details>"
).join("");

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQ.map(f => ({
    "@type": "Question", "name": f.q,
    "acceptedAnswer": { "@type": "Answer", "text": f.a }
  }))
};
const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "M11 Metro Süre ve Ücret Hesaplayıcı",
  "url": SITE,
  "applicationCategory": "TravelApplication",
  "operatingSystem": "Web",
  "inLanguage": "tr-TR",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "TRY" }
};

// --- Sayfa -----------------------------------------------------------------
const HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>İstanbul Havalimanı Metrosu M11 — Süre, Ücret ve Sefer Saatleri 2026 · Gayrettepe · Halkalı</title>
<meta name="description" content="İstanbul Havalimanı metrosu (M11) ile iki istasyon arası kaç dakika, kaç TL? Güncel 2026 sefer süreleri, ilk/son tren saatleri, durak listesi ve resmî ücret tarifesi. Gayrettepe – İstanbul Havalimanı – Halkalı.">
<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:title" content="İstanbul Havalimanı Metrosu M11 — Süre, Ücret & Sefer Saatleri 2026">
<meta property="og:description" content="M11 hattında iki istasyon arası süre, mesafe ve güncel ücret. Sefer saatleri, durak listesi ve ücret tarifesi tek sayfada.">
<meta property="og:locale" content="tr_TR">
<meta property="og:url" content="${SITE}/">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#12100F">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&family=Martian+Mono:wght@600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(appJsonLd)}</script>
<style>
  :root{
    --paper:#F1EADC; --paper-2:#FBF6EC; --card:#FCF8EF;
    --ink:#17140F; --muted:#6C6250; --faint:#9A8F79;
    --line:#F2410C; --line-deep:#C7330A; --line-soft:rgba(242,65,12,.12);
    --edge:#E0D7C4; --node:#CDC3AC; --chip:#EEE7D6;
    --board:#161310; --board-ink:#EDE4D2; --board-dim:#8E836E; --board-num:#FF7A3D;
    --stat:#F4EEE1; --ring:rgba(242,65,12,.20);
  }
  @media (prefers-color-scheme:dark){
    :root{
      --paper:#0D0B09; --paper-2:#151210; --card:#161310;
      --ink:#F0E7D6; --muted:#9C917C; --faint:#6E6553;
      --line:#FF5A2A; --line-deep:#FF7C52; --line-soft:rgba(255,90,42,.16);
      --edge:#2A2520; --node:#3A342B; --chip:#1E1A16;
      --board:#080706; --board-ink:#EEE5D3; --board-dim:#776E5C; --board-num:#FF7A3D;
      --stat:#1A1611; --ring:rgba(255,90,42,.28);
    }
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{
    background:var(--paper); color:var(--ink); line-height:1.62;
    font-family:"Instrument Sans",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    -webkit-font-smoothing:antialiased; letter-spacing:.1px;
    padding:0 16px 64px; display:flex; justify-content:center;
    background-image:
      radial-gradient(120% 80% at 100% -10%, var(--line-soft), transparent 55%),
      radial-gradient(90% 60% at -10% 0%, rgba(0,0,0,.03), transparent 60%);
  }
  /* ince kağıt tanesi (grain) */
  body::after{content:""; position:fixed; inset:0; pointer-events:none; z-index:9; opacity:.5;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.035'/%3E%3C/svg%3E");}
  .wrap{width:100%; max-width:660px; position:relative; z-index:1}

  /* --- üst hat şeridi + başlık --- */
  .topline{height:6px; background:var(--line); border-radius:0 0 4px 4px; margin:0 auto; width:100%}
  header{padding:34px 0 8px}
  .kicker{display:flex; align-items:center; gap:11px; margin-bottom:20px}
  .roundel{flex:none; width:46px; height:46px; border-radius:50%; background:var(--line); color:#fff;
    display:flex; align-items:center; justify-content:center; font-family:"Bricolage Grotesque",sans-serif;
    font-weight:800; font-size:17px; letter-spacing:-.5px; box-shadow:0 6px 18px rgba(242,65,12,.30);}
  .kicker .kt{font-size:11.5px; letter-spacing:2.4px; text-transform:uppercase; color:var(--muted); font-weight:600; line-height:1.35}
  .kicker .kt b{color:var(--ink); display:block; letter-spacing:1.6px}
  h1{font-family:"Bricolage Grotesque",sans-serif; font-weight:800; font-size:clamp(30px,7vw,46px);
    line-height:1.02; letter-spacing:-1.4px; margin:0 0 14px; text-wrap:balance}
  h1 em{font-style:normal; color:var(--line)}
  .lede{color:var(--muted); font-size:15.5px; max-width:52ch; margin:0}
  .facts{display:flex; flex-wrap:wrap; gap:8px; margin-top:18px}
  .facts span{font-size:12px; font-weight:600; color:var(--muted); background:var(--chip);
    border:1px solid var(--edge); padding:5px 11px; border-radius:99px}
  .facts span b{color:var(--line)}

  h2{font-family:"Bricolage Grotesque",sans-serif; font-weight:700; font-size:20px; letter-spacing:-.4px;
    margin:44px 0 4px; display:flex; align-items:center; gap:10px}
  h2::before{content:""; width:9px; height:9px; background:var(--line); border-radius:2px; transform:rotate(45deg); flex:none}
  .sub{color:var(--faint); font-size:13px; margin:2px 0 16px 19px}

  /* --- ana kart --- */
  .card{background:var(--card); border:1px solid var(--edge); border-radius:22px; overflow:hidden; margin-top:22px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset, 0 2px 4px rgba(23,20,15,.05), 0 26px 60px -24px rgba(23,20,15,.30);}
  .picker{display:grid; grid-template-columns:1fr 46px 1fr; align-items:end; gap:10px; padding:22px 22px 18px}
  .field{min-width:0}
  .field label{display:flex; align-items:center; gap:6px; font-size:11px; letter-spacing:1.4px; text-transform:uppercase;
    color:var(--faint); font-weight:600; margin:0 0 7px 2px}
  .field label b{width:14px; height:14px; border-radius:50%; background:var(--line); color:#fff; font-size:9px;
    display:inline-flex; align-items:center; justify-content:center; font-weight:800; letter-spacing:0}
  .field.to label b{background:var(--ink)}
  .selwrap{position:relative}
  select{width:100%; height:52px; padding:0 34px 0 15px; font-size:16px; font-weight:600; font-family:inherit; color:var(--ink);
    background:var(--paper-2); border:1.5px solid var(--edge); border-radius:14px; appearance:none; cursor:pointer;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236C6250' stroke-width='2.6' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 13px center; transition:border-color .15s, box-shadow .15s;}
  select:focus{outline:none; border-color:var(--line); box-shadow:0 0 0 4px var(--ring)}
  .swap{align-self:end; width:46px; height:52px; border:1.5px solid var(--edge); background:var(--paper-2);
    border-radius:14px; cursor:pointer; color:var(--line); display:flex; align-items:center; justify-content:center;
    transition:transform .3s cubic-bezier(.34,1.56,.64,1), background .15s, border-color .15s;}
  .swap:hover{background:var(--line-soft); border-color:var(--line)}
  .swap:active{transform:rotate(180deg) scale(.92)}

  /* --- kalkış panosu (departure board) --- */
  .board{background:var(--board); padding:26px 22px 24px; position:relative; overflow:hidden}
  .board::before{content:""; position:absolute; inset:0; opacity:.5;
    background:repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0 1px, transparent 1px 3px)}
  .board>*{position:relative}
  .route{font-family:"Bricolage Grotesque",sans-serif; font-weight:600; font-size:15px; color:var(--board-ink);
    display:flex; align-items:center; justify-content:center; gap:9px; flex-wrap:wrap; text-align:center}
  .route .arr{color:var(--line); font-weight:800}
  .time{margin:12px 0 4px; display:flex; align-items:baseline; justify-content:center; gap:10px}
  .time b{font-family:"Martian Mono",monospace; font-weight:700; font-size:clamp(52px,15vw,74px); color:var(--board-num);
    line-height:.9; font-variant-numeric:tabular-nums; letter-spacing:-2px; text-shadow:0 0 34px rgba(255,122,61,.30);
    transition:opacity .18s, transform .18s;}
  .time .unit{color:var(--board-dim); font-size:15px; font-weight:600}
  .dir{color:var(--board-dim); font-size:11.5px; letter-spacing:2px; text-transform:uppercase; text-align:center; font-weight:600}

  /* --- istatistik hücreleri --- */
  .stats{display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:var(--edge)}
  .stat{background:var(--card); padding:15px 16px}
  .stat .k{display:block; font-size:11px; letter-spacing:.8px; text-transform:uppercase; color:var(--faint); margin-bottom:3px; font-weight:600}
  .stat .v b{font-family:"Bricolage Grotesque",sans-serif; font-size:23px; font-weight:800; letter-spacing:-.5px}
  .stat.fare .v b{color:var(--line)}
  .stat .sub{display:block; font-size:11px; color:var(--muted); margin-top:2px}
  .note{font-size:12.5px; color:var(--muted); padding:14px 22px; margin:0; border-top:1px solid var(--edge); background:var(--stat)}

  /* --- dokunmatik hat şeridi --- */
  .railcard{background:var(--card); border:1px solid var(--edge); border-radius:22px; padding:18px 4px 8px; margin-top:22px; overflow:hidden}
  .railhead{display:flex; align-items:center; justify-content:space-between; gap:10px; padding:0 18px 14px}
  .railhint{font-size:12.5px; color:var(--muted); font-weight:500}
  .railhint b{color:var(--line); font-weight:700}
  .reset{font-size:12px; font-weight:600; color:var(--muted); background:none; border:1px solid var(--edge);
    border-radius:99px; padding:5px 12px; cursor:pointer; font-family:inherit; white-space:nowrap}
  .reset:hover{border-color:var(--line); color:var(--line)}
  .railscroll{overflow-x:auto; overflow-y:hidden; padding:6px 18px 4px; -webkit-overflow-scrolling:touch; scrollbar-width:thin}
  .rail{position:relative; display:flex; min-width:max-content; padding-top:8px}
  .rail::before{content:""; position:absolute; left:0; right:0; top:15px; height:3px; background:var(--node); border-radius:2px}
  .railfill{position:absolute; top:15px; height:3px; background:var(--line); border-radius:2px; width:0; left:0;
    transition:left .35s cubic-bezier(.4,0,.2,1), width .35s cubic-bezier(.4,0,.2,1)}
  .node{position:relative; flex:none; width:74px; background:none; border:0; cursor:pointer; padding:0 2px 6px;
    font-family:inherit; color:var(--faint); display:flex; flex-direction:column; align-items:center; gap:0}
  .node .dot{width:15px; height:15px; border-radius:50%; background:var(--node); border:3px solid var(--card);
    box-shadow:0 0 0 1px var(--node); transition:all .2s; margin-bottom:9px; position:relative; z-index:2}
  .node[data-t] .dot{width:17px; height:17px; background:var(--card); box-shadow:0 0 0 3px var(--node)}
  .node .pin{position:absolute; top:-9px; width:0; height:0; opacity:0; transform:scale(.4); transition:all .25s cubic-bezier(.34,1.56,.64,1)}
  .node .nlabel{font-size:10.5px; font-weight:600; line-height:1.2; text-align:center; max-width:70px; word-break:break-word; transition:color .2s}
  .node:hover .dot{box-shadow:0 0 0 2px var(--line)}
  .node.between .dot{background:var(--line); box-shadow:0 0 0 1px var(--line)}
  .node.between[data-t] .dot{background:var(--card); box-shadow:0 0 0 3px var(--line)}
  .node.between .nlabel{color:var(--muted)}
  .node.pick .dot{width:19px; height:19px; background:var(--line); box-shadow:0 0 0 4px var(--ring); z-index:3}
  .node.pick .nlabel{color:var(--ink); font-weight:700}
  .node.pick .pin{opacity:1; transform:scale(1); border-left:6px solid transparent; border-right:6px solid transparent;
    border-top:9px solid var(--line); filter:drop-shadow(0 3px 4px rgba(242,65,12,.4))}
  .node.pick.to .dot{background:var(--ink); box-shadow:0 0 0 4px var(--ring)}
  .node.pick.to .pin{border-top-color:var(--ink)}
  .node .tagab{position:absolute; top:-26px; font-size:9px; font-weight:800; letter-spacing:.5px; color:#fff;
    background:var(--line); width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center;
    opacity:0; transform:translateY(4px); transition:all .25s}
  .node.pick .tagab{opacity:1; transform:translateY(0)}
  .node.pick.to .tagab{background:var(--ink)}

  /* --- sık aranan güzergâhlar --- */
  .routes{display:grid; gap:10px; margin-top:22px}
  button.jump{display:grid; grid-template-columns:1fr auto; align-items:center; gap:6px 14px; width:100%;
    background:var(--card); border:1px solid var(--edge); border-radius:16px; padding:15px 16px; cursor:pointer;
    font-family:inherit; color:var(--ink); text-align:left; transition:border-color .15s, transform .12s, box-shadow .15s;}
  button.jump:hover{border-color:var(--line); transform:translateY(-1px); box-shadow:0 10px 26px -14px rgba(242,65,12,.5)}
  button.jump:active{transform:translateY(0)}
  .j-od{font-family:"Bricolage Grotesque",sans-serif; font-size:15.5px; font-weight:700; letter-spacing:-.3px; grid-row:1; display:flex; align-items:center; gap:8px; flex-wrap:wrap}
  .j-od i{color:var(--line); font-style:normal; font-weight:800}
  .j-meta{grid-row:2; display:flex; align-items:center; gap:14px; font-size:12.5px; color:var(--muted); flex-wrap:wrap}
  .j-meta b{color:var(--line); font-weight:700; font-family:"Martian Mono",monospace; font-size:12px}
  .j-meta em{font-style:normal}
  .j-go{grid-row:1 / span 2; grid-column:2; font-size:20px; color:var(--line); font-weight:700; transition:transform .2s}
  button.jump:hover .j-go{transform:translateX(4px)}

  /* --- tablolar --- */
  .tablewrap{overflow-x:auto; border:1px solid var(--edge); border-radius:16px; margin-top:18px; background:var(--card)}
  table{border-collapse:collapse; width:100%; font-size:13px}
  th,td{text-align:left; padding:11px 13px; border-bottom:1px solid var(--edge); vertical-align:top}
  th{font-family:"Bricolage Grotesque",sans-serif; font-weight:700; color:var(--muted); font-size:11.5px;
    letter-spacing:.3px; background:var(--stat); position:sticky; top:0}
  tr:last-child td{border-bottom:none}
  tbody tr{transition:background .12s} tbody tr:hover{background:var(--stat)}
  .st-name b{font-weight:700; font-family:"Bricolage Grotesque",sans-serif} .st-name span{display:block; font-size:11.5px; color:var(--faint); font-family:"Instrument Sans"}
  .nowrap{white-space:nowrap; font-variant-numeric:tabular-nums; font-size:12.5px}
  td:nth-child(2),td:nth-child(3){color:var(--muted)}
  .fine{font-size:12.5px; color:var(--faint); margin-top:12px; line-height:1.55}

  /* --- SSS --- */
  details{border:1px solid var(--edge); border-radius:14px; padding:0 16px; margin-top:10px; background:var(--card); transition:border-color .15s}
  details[open]{border-color:var(--line)}
  summary{cursor:pointer; padding:15px 0; font-weight:600; font-size:15px; list-style:none; display:flex; justify-content:space-between; gap:14px; align-items:center}
  summary::-webkit-details-marker{display:none}
  summary::after{content:"+"; flex:none; width:24px; height:24px; border-radius:50%; background:var(--chip);
    color:var(--line); font-weight:700; font-size:17px; display:flex; align-items:center; justify-content:center; transition:transform .2s}
  details[open] summary::after{content:"–"; background:var(--line); color:#fff; transform:rotate(180deg)}
  details p{margin:0 0 15px; font-size:14px; color:var(--muted)}

  .foot{font-size:12.5px; color:var(--muted); margin-top:44px; padding-top:20px; border-top:1px solid var(--edge); line-height:1.6}
  .foot b{color:var(--ink)} .foot a{color:var(--line); text-decoration:none; border-bottom:1px solid var(--line-soft)}
  .foot a:hover{border-bottom-color:var(--line)}

  /* --- açılış animasyonu --- */
  @keyframes rise{from{opacity:0; transform:translateY(16px)} to{opacity:1; transform:translateY(0)}}
  .rv{opacity:0; animation:rise .7s cubic-bezier(.2,.7,.2,1) forwards}
  header{animation:rise .7s cubic-bezier(.2,.7,.2,1) both}
  .card{animation:rise .8s cubic-bezier(.2,.7,.2,1) .08s both}
  .railcard{animation:rise .8s cubic-bezier(.2,.7,.2,1) .16s both}

  @media (max-width:560px){
    .picker{grid-template-columns:1fr; gap:12px}
    .swap{width:100%; height:40px; transform:rotate(90deg)}
    .swap:active{transform:rotate(270deg) scale(.92)}
    .field.to{order:3}
  }
  @media (prefers-reduced-motion:reduce){
    *{animation:none !important; transition:none !important}
  }
</style>
</head>
<body>
<main class="wrap">
  <div class="topline"></div>
  <header>
    <div class="kicker">
      <span class="roundel">M11</span>
      <span class="kt">M11 Hattı · İstanbul Metrosu<b>İstanbul Havalimanı Metro Rehberi</b></span>
    </div>
    <h1>İki durak arası <em>kaç dakika,</em> kaç lira?</h1>
    <p class="lede">Gayrettepe – İstanbul Havalimanı – Halkalı hattında yolculuğunu seç; süreyi, mesafeyi, istasyon sayısını ve güncel 2026 ücretini anında gör.</p>
    <div class="facts"><span><b>69</b> km hat</span><span><b>15</b> istasyon</span><span><b>120</b> km/s</span><span>Güncel <b>2026</b> verisi</span></div>
  </header>

  <div class="card">
    <div class="picker">
      <div class="field from">
        <label for="from"><b>A</b> Nereden</label>
        <div class="selwrap"><select id="from">${opts(0)}</select></div>
      </div>
      <button id="swap" class="swap" type="button" aria-label="Yönü değiştir" title="Yönü değiştir">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/></svg>
      </button>
      <div class="field to">
        <label for="to"><b>B</b> Nereye</label>
        <div class="selwrap"><select id="to">${opts(14)}</select></div>
      </div>
    </div>
    <div class="board">
      <div class="route" id="route">Gayrettepe <span class="arr">→</span> Halkalı</div>
      <div class="time"><b id="time">64</b><span class="unit">dakika</span></div>
      <div class="dir" id="dir">Halkalı yönü</div>
    </div>
    <div class="stats">
      <div class="stat"><span class="k">Mesafe</span><span class="v"><b id="dist">69,1</b> km</span></div>
      <div class="stat"><span class="k">İstasyon</span><span class="v"><b id="stops">15</b></span></div>
      <div class="stat fare"><span class="k">Ücret · tam</span><span class="v"><b id="fare">₺66,54</b></span><span class="sub" id="faresub"></span></div>
    </div>
    <p class="note" id="note"></p>
  </div>

  <div class="railcard">
    <div class="railhead">
      <span class="railhint" id="railhint">Haritadan istasyona dokun: önce <b>kalkış</b>, sonra <b>varış</b>.</span>
      <button class="reset" id="railreset" type="button">Sıfırla</button>
    </div>
    <div class="railscroll" id="railscroll">
      <div class="rail" id="rail"><div class="railfill" id="railfill"></div>${railHTML}</div>
    </div>
  </div>

  <h2>Sık aranan güzergâhlar</h2>
  <p class="sub">Tek dokunuşla en çok aranan yolculukları hesapla.</p>
  <div class="routes">${popularHTML}</div>

  <h2>Durak listesi & ilk / son tren</h2>
  <p class="sub">15 istasyon, aktarma noktaları ve her iki yön için ilk–son sefer saatleri.</p>
  <div class="tablewrap">
    <table>
      <thead><tr><th>İstasyon</th><th>İlçe</th><th>Aktarma</th><th>Halkalı yönü<br>(ilk–son)</th><th>Gayrettepe yönü<br>(ilk–son)</th></tr></thead>
      <tbody>${stationRows}</tbody>
    </table>
  </div>

  <h2>Ücret tarifesi · 16 Şubat 2026</h2>
  <p class="sub">İstasyon sayısına göre resmî İBB/UKOME kademeleri.</p>
  <div class="tablewrap">
    <table>
      <thead><tr><th>Mesafe</th><th>Tam</th><th>Öğrenci</th><th>İndirimli (sosyal)</th></tr></thead>
      <tbody>${fareRows}</tbody>
    </table>
  </div>
  <p class="fine">İstasyon sayısı uçtan uca (iki durak dahil) sayılır. Girişte en yüksek ücret alınır, çıkışta gidilmeyen mesafe karta iade edilir. Gece 00:30–05:30 seferlerinde çift ücret uygulanır.</p>

  <h2>Sıkça sorulan sorular</h2>
  <p class="sub">M11 hakkında en çok merak edilenler.</p>
  ${faqHTML}

  <p class="foot">
    <b>Gayriresmî araçtır.</b> Süreler TCDD son tren tarifesine dayanır ve gündüz seferleriyle 1–2 dk oynayabilir. Ücretler İBB/UKOME 16.02.2026 tarifesindendir; değişebilir. Yolculuk öncesi
    <a href="https://www.tcddtasimacilik.gov.tr" rel="noopener">tcddtasimacilik.gov.tr</a> ve
    <a href="https://tuhim.ibb.gov.tr" rel="noopener">İBB ücret tarifesi</a> sayfalarını kontrol edin.
  </p>
</main>

<script>
(function(){
  var ST = ${JSON.stringify(S.map(s => ({ n: s.name, km: s.km, tH: s.tH, tG: s.tG })))};
  var FARE = ${JSON.stringify(FARE)};
  var FREE = ${JSON.stringify(FREE)};
  var CAMP_END = new Date(2026, 6, 31, 23, 59, 59);
  var lira = function(v){ return "₺" + v.toFixed(2).replace(".", ","); };
  function fareFor(n){ for(var k=0;k<FARE.length;k++){ if(n<=FARE[k].maxN) return FARE[k]; } return FARE[FARE.length-1]; }
  var $ = function(id){ return document.getElementById(id); };
  var fromEl = $("from"), toEl = $("to"), timeEl = $("time");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setTime(v){
    if(reduce){ timeEl.textContent = v; return; }
    timeEl.style.opacity = "0"; timeEl.style.transform = "translateY(5px)";
    setTimeout(function(){ timeEl.textContent = v; timeEl.style.opacity = "1"; timeEl.style.transform = "translateY(0)"; }, 130);
  }

  // --- hat şeridi düğümleri ---
  var nodes = Array.prototype.slice.call(document.querySelectorAll(".node"));
  var fill = $("railfill");
  nodes.forEach(function(el){
    var tag = document.createElement("span"); tag.className = "tagab"; el.appendChild(tag);
    el.addEventListener("click", function(){ pickNode(+el.getAttribute("data-idx")); });
  });
  function paintRail(){
    var i = +fromEl.value, j = +toEl.value, lo = Math.min(i,j), hi = Math.max(i,j);
    nodes.forEach(function(el, k){
      el.classList.remove("between","pick","to");
      var tag = el.querySelector(".tagab");
      if(k > lo && k < hi) el.classList.add("between");
      if(k === i){ el.classList.add("pick"); if(tag) tag.textContent = "A"; }
      if(k === j){ el.classList.add("pick"); if(k===j && i!==j) el.classList.add("to"); if(tag) tag.textContent = (i===j? "A/B" : "B"); }
    });
    // dolgu çizgisi konumu
    var a = nodes[lo], b = nodes[hi];
    if(a && b){
      var x1 = a.offsetLeft + a.offsetWidth/2, x2 = b.offsetLeft + b.offsetWidth/2;
      fill.style.left = x1 + "px"; fill.style.width = (x2 - x1) + "px";
    }
  }
  var awaitingTo = false;
  var hint = $("railhint");
  function setHint(html){ hint.innerHTML = html; }
  function pickNode(k){
    if(!awaitingTo){
      fromEl.value = k; awaitingTo = true;
      setHint("Kalkış: <b>" + ST[k].n + "</b> — şimdi <b>varış</b> istasyonuna dokun.");
    } else {
      toEl.value = k; awaitingTo = false;
      setHint("Haritadan istasyona dokun: önce <b>kalkış</b>, sonra <b>varış</b>.");
    }
    scrollNodeIntoView(k);
    calc();
  }
  function scrollNodeIntoView(k){
    var el = nodes[k], sc = $("railscroll"); if(!el||!sc) return;
    var target = el.offsetLeft - sc.clientWidth/2 + el.offsetWidth/2;
    sc.scrollTo({ left: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
  }

  function calc(){
    var i = +fromEl.value, j = +toEl.value, a = ST[i], b = ST[j];
    var dist = Math.abs(a.km - b.km), stations = Math.abs(i - j) + 1;
    var time = j > i ? (b.tH - a.tH) : (b.tG - a.tG);
    var dir = j > i ? "Halkalı yönü" : (j < i ? "Gayrettepe yönü" : "—");
    $("route").innerHTML = a.n + ' <span class="arr">→</span> ' + b.n;
    $("dist").textContent = dist.toFixed(1).replace(".", ",");
    $("stops").textContent = i === j ? "0" : stations;
    $("dir").textContent = dir;
    var fare = $("fare"), sub = $("faresub"), note = $("note");
    paintRail();
    if(i === j){ setTime("0"); fare.textContent = "—"; sub.textContent = ""; note.textContent = "Kalkış ve varış aynı istasyon. Farklı bir durak seçin."; return; }
    setTime(String(time));
    var campaign = new Date() <= CAMP_END;
    if(campaign && FREE.indexOf(i) !== -1){
      fare.textContent = "Ücretsiz"; sub.textContent = "31 Tem 2026'ya kadar biniş bedava";
    } else {
      var f = fareFor(stations);
      fare.textContent = lira(f.tam);
      sub.textContent = "Öğr. " + lira(f.ogr) + " · Sosyal " + lira(f.sos);
    }
    note.textContent = "Süre, TCDD son tren tarifesinden (" + dir + "). Saatler dakikaya yuvarlıdır; iki yön ±1 dk farklı olabilir.";
  }

  fromEl.addEventListener("change", function(){ awaitingTo = false; calc(); });
  toEl.addEventListener("change", function(){ awaitingTo = false; calc(); });
  $("swap").addEventListener("click", function(){ var t = fromEl.value; fromEl.value = toEl.value; toEl.value = t; awaitingTo = false; calc(); });
  $("railreset").addEventListener("click", function(){
    fromEl.value = 0; toEl.value = 14; awaitingTo = false;
    setHint("Haritadan istasyona dokun: önce <b>kalkış</b>, sonra <b>varış</b>.");
    calc();
  });

  var jumps = document.getElementsByClassName("jump");
  for(var r=0;r<jumps.length;r++){
    (function(el){
      var df = el.getAttribute("data-from"); if(df === null) return;
      el.addEventListener("click", function(){
        fromEl.value = df; toEl.value = el.getAttribute("data-to"); awaitingTo = false; calc();
        document.querySelector(".card").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
    })(jumps[r]);
  }

  window.addEventListener("resize", paintRail);
  window.addEventListener("load", paintRail);
  calc();
})();
</script>
</body>
</html>`;

const ROBOTS = "User-agent: *\nAllow: /\nSitemap: " + SITE + "/sitemap.xml\n";
const SITEMAP = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  "  <url><loc>" + SITE + "/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n" +
  "</urlset>\n";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/robots.txt")
      return new Response(ROBOTS, { headers: { "content-type": "text/plain; charset=utf-8" } });
    if (url.pathname === "/sitemap.xml")
      return new Response(SITEMAP, { headers: { "content-type": "application/xml; charset=utf-8" } });
    if (url.pathname === "/health")
      return new Response("ok");
    return new Response(HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  },
};
