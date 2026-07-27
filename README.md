# İstanbul Raylı Sistem Hesaplayıcı — M11 & Marmaray

M11 ve Marmaray'ın **57 istasyonu arasında** süre, mesafe, durak sayısı, aktarma ve
güncel 2026 ücretini hesaplayan bağımlılıksız statik site. Cloudflare Pages ile yayınlanır.

Hesaplayıcı **ağ genelinde** çalışır: iki hat Halkalı'da kesişir, farklı hatlardaki
istasyonlar seçildiğinde rota otomatik olarak iki bacağa bölünür ve aktarma payı
eklenir. Örnek: *İstanbul Havalimanı → Üsküdar* = 85 dk, 22 durak, ₺95,63.

| Sayfa | Odak | İstasyon |
|---|---|---|
| `/` | **M11** — Gayrettepe · İstanbul Havalimanı · Halkalı | 15 |
| `/marmaray` | **Marmaray B1** — Halkalı · Yenikapı · Söğütlüçeşme · Gebze | 43 |

İki sayfa da aynı ağ genelinde hesaplayıcıyı taşır; farkları başlık, durak/ücret
tablosu ve SSS içeriğidir (her sayfa kendi hattının aramalarını hedefler).

## Yapı
- `worker.js` — **tek kaynak.** Hat verisi, ücret kademeleri, sayfa şablonu ve
  istemci JS'i burada. Cloudflare Worker biçiminde; `export default { fetch }`.
- `build.mjs` — `worker.js`'ten statik dosyaları üretir
- `index.html`, `marmaray/index.html` — üretilmiş sayfalar (tüm CSS/JS gömülü)
- `robots.txt`, `sitemap.xml` — üretilmiş SEO dosyaları

`index.html` ve `marmaray/index.html` **elle düzenlenmemeli** — `worker.js` değişip
`build.mjs` çalıştırılmalı, yoksa iki kopya birbirinden ayrışır.

## Güncelleme
```bash
node build.mjs      # index.html, marmaray/index.html, robots.txt, sitemap.xml
```

Yeni hat eklemek için `worker.js` içindeki `LINES` nesnesine bir giriş ve
`build.mjs` içindeki `OUT` eşlemesine bir satır eklemek yeterli.

## Veri kaynakları ve yöntem
- **Süreler:** TCDD son tren tarifesinden türetildi. Son tren uçtan uca giden tek
  bir trendir, bu yüzden geçiş saatleri süreyle birebir tutarlıdır.
- **İlk tren saatleri:** her istasyonun *kendi* ilk treni; hepsi aynı sefere ait
  değildir (ara depolardan kalkışlar var). Bu yüzden sütun hat boyunca düz artmaz —
  bu bir hata değil, gerçek veridir.
- **Ücretler:** İBB/UKOME 20.07.2026 tarifesi (%10 zam sonrası). Kademe parametresi
  **gidilen durak sayısı**dır (`|i−j|`), uçtan uca istasyon sayısı değil.
  M11'de 6 kademe (13–14 durakta biter), Marmaray'da 7 durakta bir kademe.
- **Marmaray km:** istasyon koordinatlarından kümülatif kuş uçuşu mesafe, resmî
  75,771 km'ye ölçeklendi; ±birkaç yüz metre yaklaşıktır.
- **Aktarma ücreti:** Marmaray "aktarma vermeyen" ana hat olarak işletilir, yani
  Halkalı'da M11'e geçişte indirim yoktur — iki hattın ücreti **toplanır**.
- **Aktarma süresi:** yürüme payı 4 dk (tahmini) + ortalama bekleme (sefer
  aralığı ÷ 2). Gerçek bekleme 0 ile sefer aralığı arasında değişir; ölçülmüş
  peron-arası yürüme verisi yayımlanmadığı için bu kısım tahmindir.

Gayriresmîdir; ücret ve saatler değişebilir.
