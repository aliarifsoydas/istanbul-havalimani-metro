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
- **Marmaray** — yolculuk süreleri TCDD tarifesinden; **kalkışlar istasyon bazlı
  yayımlanmış tarifeden**. Her istasyonun kendi ilk ve ikinci tren saati alınıp
  15 dk aralıkla ilerletilir, yani faz istasyon istasyon gerçektir.
  Hatta **iki servis** vardır ve bu modellenir:

  | Kesim | Servis | Efektif aralık |
  |---|---|---|
  | Halkalı – Ataköy | yalnızca tam hat | 15 dk |
  | Ataköy – Pendik | tam hat + kısa servis | ~7 dk |
  | Pendik – Gebze | yalnızca tam hat | 15 dk |

  Kısa servis (Ataköy–Pendik) yalnızca **hem kalkış hem varış** bu aralıktaysa
  sayılır; değilse Pendik'te inersiniz, o yüzden 15 dk uygulanır.
- **M11** — yolculuk süreleri TCDD tarifesinden ve **saha gözlemiyle doğrulandı**
  (Kargo Terminali → Olimpiyatköy: hesap 23 dk, gözlem 23 dk). İstasyon bazlı
  ilk tren saatleri de doğrulandı (Olimpiyatköy, Gayrettepe yönü: veri 06:07,
  gözlem 06:07).

  **Kalkış dakikası yine de verilemiyor**: sefer aralığı gün içinde değişiyor.
  Sabah gözlemi 16 dk (Olimpiyatköy 06:07 → 06:23), ama 16:10'da geçen tren
  sabah anchor'undan hiçbir sabit aralıkla türetilemiyor (596 dk fark; 15'te
  39,7 · 16'da 37,25 · 20'de 29,8 sefer — hiçbiri tam sayı). Tek bir sabah
  anchor'undan gün ortasını hesaplamak bu yüzden mümkün değil; bekleme ortalama
  (aralık ÷ 2) verilir ve arayüzde aralık da yazılır.

  Bunu çözmek için gereken: **aynı istasyonda, aynı yönde, gün ortasında ardışık
  iki trenin geçiş saati.** O iki sayı gündüz aralığını ve fazını verir.
- **M5 uzantısı** (Veysel Karani, Hasanpaşa, Sultanbeyli) — İBB API'sinde
  koordinatsızdı, OSM'den alındı; süreler hattın kendi gerçek hızıyla (37 km/s)
  uzatıldı.
- **M7, M8, M9, Metrobüs** — istasyon bazlı tarife bulunamadı; süre hat toplamının
  mesafeye orantılı dağıtımı. Arayüzde `tahmini` etiketiyle gösterilir.

### Bekleme: iki farklı güven seviyesi
- **M1A–M6 ve Marmaray** (yayımlanmış tarife var): bekleme sıradaki kalkışa göre **dakikasıyla**.
  Aktarmalar fazlıdır — 5 dk erken çıkmak varış saatini hiç değiştirmeyebilir,
  1 dk geç kalmak bir sefer kaybettirebilir. Arayüzde "3 dk bekleme" yazar.
- **M11, M7, M8, M9, Metrobüs** (kalkış dakikası yayımlanmıyor):
  bekleme **ortalama** (aralık ÷ 2). Arayüzde "~8 dk bekleme (ort.)" yazar.

Bu ayrım bilinçlidir: sentetik bir tarifeden üretilen dakika, gerçek trenle
birkaç dakika kayabilir ve sahte hassasiyet yaratır.

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

### İstasyona iniş / çıkış payı
Süreler **sokaktan sokağa**: kalkış istasyonunda peron seviyesine inme, varış
istasyonunda sokağa çıkma payı dahil.

    pay = 1 + kat × 1,0 dk        (yüzey 1 dk · 3 kat 4 dk · 5 kat 6 dk)

Kat sayısı OpenStreetMap `level`/`layer` etiketlerinden, 265 istasyonun tamamı
için tarandı (209'unda etiket bulundu; bulunmayanlar yüzey kabul edilir).
Formül **saha ölçümüyle kalibre edildi**: Olimpiyatköy 3 kat, peronden sokağa
4 dakika (16:33 iniş → 16:37 çıkış).

### Aktarma
Aktarma noktaları istasyon koordinatlarından 400 m eşiğiyle bulundu (32 aktarma
yeri). Aktarma süresi = **yürüme + bekleme**.

Yürüme yatay ve dikey bileşenden oluşur:

    dk = max(taban, yatay_metre / 80 + kat_sayısı × kat_süresi)
    kat_süresi = 0,8 dk (yürüyen merdiven varsa) · 1,3 dk (yoksa)
    taban      = 3 dk (2+ kat) · 2 dk (yüzey)

- **yatay_metre**: OpenStreetMap **yaya rotalamasıyla** hesaplanan gerçek yürüyüş
  mesafesi (OSRM foot profili). Kuş uçuşu kullanılmaz: ortalama dolambaç katsayısı
  **2,84×** çıktı. Örnek — Küçükçekmece Metrobüs ↔ Marmaray: kuş uçuşu 372 m,
  gerçek yürüyüş **694 m** (D-100 üstgeçitten aşılıyor).
  İstisna: aynı adı taşıyan raylı istasyonlar tek kompleks sayılır ve yeraltı
  bağlantısı kullanıldığı için doğrudan mesafe alınır (yüzey rotalaması oraları
  gereksiz uzun gösteriyordu — M2↔M11 Gayrettepe 273 m yerine 556 m gibi).
- **kat_sayısı**: OpenStreetMap'teki `level`/`layer` etiketlerinden (32 aktarmanın
  28'inde mevcut; peron, merdiven ve asansör nesneleri taranır).
- **yürüyen merdiven**: OSM `conveying=yes` merdivenleri veya İBB API'sindeki
  `Escolator` sayısı ≥ 4.
- M1A ↔ M1B aynı peronu paylaştığı için sabit 2 dk.

Örnek: Mecidiyeköy 5 kat → 7–8 dk · Zincirlikuyu 5 kat → 5–9 dk ·
Halkalı 2 kat + 209 m → 4 dk · Ayrılık Çeşmesi 2 kat, bitişik → 3 dk.

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

### Veri denetimi
`/tmp` dışı bağımlılık yok; veri bütünlüğü şu kontrollerle doğrulanır: dizi
uzunlukları, süre/km monotonluğu, ticari hızın 15–70 km/s aralığında olması,
koordinatların İstanbul sınırlarında olması, kalkış listelerinin sıralı ve
0–1440 aralığında olması, gündüz içinde 60 dk+ boşluk bulunmaması, servis
saatlerinin kalkış listeleriyle uyumu.

Gayriresmîdir; ücret ve saatler değişebilir.
