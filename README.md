# İstanbul Metro · Marmaray · Metrobüs — Yolculuk Planlayıcı

**`/` = ağ planlayıcı.** 13 hat, 265 istasyon, 227 yer. Nereden–nereye ve kalkış
saatini seç; varış saatini, aktarmaları ve toplam ücreti dakika dakika verir.
Google Maps'ten farkı: sadece raylı sistem + metrobüs (sade), buna karşılık
**ücreti doğru hesaplar** — mesafe bazlı hatlarda kademeli tarife, metrolarda
İstanbulkart aktarma indirimi.

Hatlar: M1A, M1B, M2, M3, M4, M5, M6, M7, M8, M9, M11, Marmaray, Metrobüs.

### Süre ve sefer verisi
- **M1A, M1B, M2, M3, M4, M5, M6** — İBB Açık Veri **GTFS** tarifesinden: gerçek
  kalkış saatleri (hafta içi, ~150–290 sefer/yön) ve istasyonlar arası gerçek
  süreler. GTFS Ocak 2023 tarihli; sonradan uzayan kesimler (M3, M4, M5 uçları)
  hattın kendi gerçek hızıyla ekstrapole edildi.
- **M11 ve Marmaray** — TCDD tarifesi; süreler son tren geçişlerinden, kalkışlar
  gerçek ilk/son sefer saatine demirlenmiş 15 dk'lık sabit aralıktan.
- **M7, M8, M9, Metrobüs** — istasyon bazlı tarife bulunamadı; süre hat toplamının
  mesafeye orantılı dağıtımı. Arayüzde `tahmini` etiketiyle gösterilir.

### Bekleme fazlıdır, ortalama değil
Gerçek tarifesi olan hatlarda bekleme, **sıradaki kalkışa göre dakikasıyla**
hesaplanır. Bu önemlidir: aktarmalar fazlıdır — M11 Halkalı'ya 14:44'te varıp
Marmaray 14:58'de kalktığı için bekleme her seferinde ~11 dk çıkar, "aralık/2"
formülünün söylediği 8 dk değil. Aynı sebeple 5 dk erken çıkmak varış saatini
hiç değiştirmeyebilir, 1 dk geç kalmak 15 dk kaybettirebilir.

### Harita
Rota isteğe bağlı olarak OpenStreetMap üzerinde çizilir (Leaflet). Harita
kütüphanesi ve karolar **sayfa açılışında yüklenmez** — yalnızca kullanıcı
"Haritada göster" düğmesine bastığında istenir, böylece sayfa bağımlılıksız
ve hızlı kalır. Çizgiler istasyon koordinatlarını birleştirir; gerçek hat
güzergâhı (viraj/tünel geometrisi) değildir.

### Sefer saatleri
Her hattın ilk/son sefer saati vardır ve plan bunlara uyar: servis kapalıysa
ilk sefere kadar beklenir, aktarmada son sefer kaçırılırsa ertesi güne kayar,
kullanıcıya uyarı bandı gösterilir. M11/Marmaray'ın Cuma–Cumartesi gece ek
seferleri modellenmez.

### Aktarma
Aktarma noktaları istasyon koordinatlarından 400 m eşiğiyle bulundu (32 aktarma
yeri). Aktarma süresi = yürüme (mesafeden, 80 m/dk) + ortalama bekleme (sefer
aralığı ÷ 2). Gerçek bekleme 0 ile sefer aralığı arasında değişir.

---

## Hat rehberi sayfaları — M11 & Marmaray

M11 ve Marmaray'ın **57 istasyonu arasında** süre, mesafe, durak sayısı, aktarma ve
güncel 2026 ücretini hesaplayan bağımlılıksız statik site. Cloudflare Pages ile yayınlanır.

Hesaplayıcı **ağ genelinde** çalışır: iki hat Halkalı'da kesişir, farklı hatlardaki
istasyonlar seçildiğinde rota otomatik olarak iki bacağa bölünür ve aktarma payı
eklenir. Örnek: *İstanbul Havalimanı → Üsküdar* = 85 dk, 22 durak, ₺95,63.

| Sayfa | Odak | İstasyon |
|---|---|---|
| `/m11` | **M11** — Gayrettepe · İstanbul Havalimanı · Halkalı | 15 |
| `/marmaray` | **Marmaray B1** — Halkalı · Yenikapı · Söğütlüçeşme · Gebze | 43 |

İki sayfa da aynı ağ genelinde hesaplayıcıyı taşır; farkları başlık, durak/ücret
tablosu ve SSS içeriğidir (her sayfa kendi hattının aramalarını hedefler).

## Yapı
- `worker.js` — **tek kaynak.** Hat verisi, ücret kademeleri, sayfa şablonu ve
  istemci JS'i burada. Cloudflare Worker biçiminde; `export default { fetch }`.
- `build.mjs` — `worker.js`'ten statik dosyaları üretir
- `index.html`, `m11/index.html`, `marmaray/index.html` — üretilmiş sayfalar
- `robots.txt`, `sitemap.xml` — üretilmiş SEO dosyaları

Üretilmiş HTML dosyaları **elle düzenlenmemeli** — `worker.js` değişip
`build.mjs` çalıştırılmalı, yoksa iki kopya birbirinden ayrışır.

## Güncelleme
```bash
node build.mjs      # tüm sayfalar + robots.txt + sitemap.xml
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
