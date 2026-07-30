// ============================================================================
// M11 Metro — Süre & Ücret Hesaplayıcı  (tek dosyalık Cloudflare Worker)
// Gayrettepe · İstanbul Havalimanı · Halkalı
//
// Veri kaynakları:
//  - Süreler: TCDD "son tren" tarifesi (istasyon geçiş saatlerinden türetilmiş)
//  - Ücretler: İBB/UKOME 20.07.2026 tarifesi (resmî, 7 kademe)
//  - İstasyon/aktarma/ilçe: TCDD & Vikipedi
// Bu araç gayriresmîdir; ücret ve saatler değişebilir.
//
// >>> YAYINLAMADAN ÖNCE: SITE değerini kendi alan adınla değiştir. <<<
// ============================================================================

const SITE = "https://istanbul-havalimani-metro.pages.dev"; // yayın adresi (Cloudflare Pages)

// --- İstasyonlar (Terminal 2 kapalı olduğu için listede yok) --------------
// tH: Halkalı yönünde Gayrettepe'den itibaren dakika (son tren)
// tG: Gayrettepe yönünde Halkalı'dan itibaren dakika (son tren)
// lH/lG: son tren — uçtan uca giden TEK trenin geçiş saatleri, süreyle birebir.
// fH/fG: ilk tren — her istasyonun KENDİ ilk treni; hepsi aynı trene ait değil
//   (bazıları Taşoluk deposundan/hat ortasından kalkar). Bu yüzden sütun hat
//   boyunca düz artmaz; kopuş noktaları arasındaki bloklar kendi içinde
//   süreyle tutarlıdır (fH 11/14, fG 10/14 ardışık aralık). Düz artan bir
//   diziye "düzeltilmemeli" — gerçek veri budur.
const M11_STATIONS = [
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

// --- Ücret kademeleri (İBB/UKOME 20.07.2026) -------------------------------
// Kademe parametresi GİDİLEN DURAK sayısıdır (= |i-j|), uçtan uca istasyon
// sayısı DEĞİL. Resmî tarife 6 kademedir ve 13–14 durakta biter; uçtan uca
// yolculuk 14 duraktır ("Tam Parkur Taşıma Ücreti"). Doğrulama: UKOME'nin
// her istasyondan giriş ücreti tablosu bu modelle 15/15 tutuyor (dahil
// sayımla yalnızca 7/15). 20.07.2026 zammı: tüm kalemlere düz %10.
const M11_FARE = [
  { maxN: 3, tam: 37.40, ogr: 18.13, sos: 26.58 },
  { maxN: 6, tam: 42.34, ogr: 20.80, sos: 30.45 },
  { maxN: 8, tam: 47.89, ogr: 23.39, sos: 34.16 },
  { maxN: 10, tam: 53.74, ogr: 25.97, sos: 37.87 },
  { maxN: 12, tam: 59.90, ogr: 28.55, sos: 41.58 },
  { maxN: 14, tam: 66.39, ogr: 31.13, sos: 45.30 },
];
const M11_FREE = [10, 11, 12, 13, 14]; // 31 Tem 2026'ya kadar biniş ücretsiz istasyonlar

// --- Marmaray B1 (Halkalı – Gebze) ----------------------------------------
// tH: Gebze yönünde Halkalı'dan itibaren dakika · tG: Halkalı yönünde Gebze'den
// Süreler son tren sütunundan türetildi (Halkalı 23:28 / Gebze 23:20 kalkışlı
// uçtan uca tren). Uçtan uca 107/108 dk — Vikipedi'nin 108 dk'sıyla uyumlu.
// fH/fG yine her istasyonun KENDİ ilk treni (ara depolardan kalkışlar var).
// km: istasyon koordinatlarından kümülatif kuş uçuşu, resmî 75,771 km'ye
// ölçeklendi (ham 71,42 km → ×1,0609); ±birkaç yüz metre yaklaşıktır.
const B1_STATIONS = [
  { name: "Halkalı", ilce: "Küçükçekmece", near: "M11 · YHT Garı", km: 0.00, tH: 0, tG: 108, fH: "05:58", lH: "23:28", fG: "—", lG: "01:08", akt: "M11, YHT, Bölgesel" },
  { name: "Mustafa Kemal", ilce: "Küçükçekmece", near: "", km: 1.59, tH: 3, tG: 105, fH: "06:01", lH: "23:31", fG: "06:22", lG: "01:05", akt: "—" },
  { name: "Küçükçekmece", ilce: "Küçükçekmece", near: "", km: 3.65, tH: 5, tG: 102, fH: "06:03", lH: "23:33", fG: "06:19", lG: "01:02", akt: "Metrobüs" },
  { name: "Florya", ilce: "Bakırköy", near: "", km: 5.92, tH: 8, tG: 99, fH: "06:06", lH: "23:36", fG: "06:16", lG: "00:59", akt: "—" },
  { name: "Florya Akvaryum", ilce: "Bakırköy", near: "İstanbul Akvaryum", km: 6.95, tH: 10, tG: 97, fH: "06:08", lH: "23:38", fG: "06:14", lG: "00:57", akt: "—" },
  { name: "Yeşilköy", ilce: "Bakırköy", near: "", km: 9.51, tH: 13, tG: 94, fH: "06:11", lH: "23:41", fG: "06:11", lG: "00:54", akt: "—" },
  { name: "Yeşilyurt", ilce: "Bakırköy", near: "", km: 10.64, tH: 15, tG: 92, fH: "06:13", lH: "23:43", fG: "06:09", lG: "00:52", akt: "—" },
  { name: "Ataköy", ilce: "Bakırköy", near: "", km: 13.08, tH: 18, tG: 89, fH: "06:02", lH: "23:46", fG: "06:06", lG: "00:49", akt: "M9" },
  { name: "Bakırköy", ilce: "Bakırköy", near: "", km: 14.54, tH: 21, tG: 87, fH: "06:05", lH: "23:49", fG: "06:04", lG: "00:47", akt: "M3, YHT" },
  { name: "Yenimahalle", ilce: "Zeytinburnu", near: "", km: 15.32, tH: 23, tG: 85, fH: "06:07", lH: "23:51", fG: "06:02", lG: "00:45", akt: "—" },
  { name: "Zeytinburnu-Fişekhane", ilce: "Zeytinburnu", near: "", km: 17.55, tH: 26, tG: 82, fH: "06:01", lH: "23:54", fG: "06:05", lG: "00:42", akt: "—" },
  { name: "Kazlıçeşme", ilce: "Zeytinburnu", near: "", km: 18.86, tH: 28, tG: 80, fH: "06:03", lH: "23:56", fG: "06:03", lG: "00:40", akt: "—" },
  { name: "Yenikapı", ilce: "Fatih", near: "Aktarma merkezi", km: 22.27, tH: 32, tG: 76, fH: "06:00", lH: "00:00", fG: "05:59", lG: "00:36", akt: "M1, M2, T1, İDO" },
  { name: "Sirkeci", ilce: "Fatih", near: "Sirkeci Garı", km: 24.74, tH: 35, tG: 73, fH: "06:03", lH: "00:03", fG: "06:03", lG: "00:33", akt: "T1, Vapur" },
  { name: "Üsküdar", ilce: "Üsküdar", near: "Üsküdar İskelesi", km: 28.35, tH: 39, tG: 69, fH: "06:00", lH: "00:07", fG: "05:59", lG: "00:29", akt: "M5, Vapur" },
  { name: "Ayrılık Çeşmesi", ilce: "Kadıköy", near: "", km: 31.68, tH: 43, tG: 65, fH: "06:04", lH: "00:11", fG: "06:03", lG: "00:25", akt: "M4" },
  { name: "Söğütlüçeşme", ilce: "Kadıköy", near: "Kadıköy", km: 32.96, tH: 46, tG: 62, fH: "06:00", lH: "00:14", fG: "06:00", lG: "00:22", akt: "Metrobüs, YHT" },
  { name: "Feneryolu", ilce: "Kadıköy", near: "", km: 34.70, tH: 48, tG: 59, fH: "06:02", lH: "00:16", fG: "06:04", lG: "00:19", akt: "—" },
  { name: "Göztepe", ilce: "Kadıköy", near: "", km: 35.94, tH: 50, tG: 57, fH: "06:04", lH: "00:18", fG: "06:02", lG: "00:17", akt: "M12" },
  { name: "Erenköy", ilce: "Kadıköy", near: "", km: 37.46, tH: 52, tG: 55, fH: "06:06", lH: "00:20", fG: "06:00", lG: "00:15", akt: "—" },
  { name: "Suadiye", ilce: "Kadıköy", near: "", km: 38.95, tH: 55, tG: 52, fH: "06:01", lH: "00:23", fG: "06:05", lG: "00:12", akt: "—" },
  { name: "Bostancı", ilce: "Kadıköy", near: "", km: 40.10, tH: 57, tG: 50, fH: "06:03", lH: "00:25", fG: "06:03", lG: "00:10", akt: "M4, Vapur" },
  { name: "Küçükyalı", ilce: "Maltepe", near: "", km: 41.58, tH: 60, tG: 47, fH: "06:06", lH: "00:28", fG: "06:00", lG: "00:07", akt: "—" },
  { name: "İdealtepe", ilce: "Maltepe", near: "", km: 42.75, tH: 62, tG: 45, fH: "06:00", lH: "00:30", fG: "06:06", lG: "00:05", akt: "—" },
  { name: "Süreyya Plajı", ilce: "Maltepe", near: "", km: 44.33, tH: 64, tG: 43, fH: "06:02", lH: "00:32", fG: "06:04", lG: "00:03", akt: "—" },
  { name: "Maltepe", ilce: "Maltepe", near: "", km: 45.45, tH: 66, tG: 41, fH: "06:04", lH: "00:34", fG: "06:02", lG: "00:01", akt: "Vapur" },
  { name: "Cevizli", ilce: "Kartal", near: "", km: 47.75, tH: 69, tG: 38, fH: "06:00", lH: "00:37", fG: "06:06", lG: "23:58", akt: "—" },
  { name: "Atalar", ilce: "Kartal", near: "", km: 49.63, tH: 71, tG: 36, fH: "06:02", lH: "00:39", fG: "06:04", lG: "23:56", akt: "—" },
  { name: "Başak", ilce: "Kartal", near: "", km: 50.81, tH: 73, tG: 34, fH: "06:04", lH: "00:41", fG: "06:02", lG: "23:54", akt: "—" },
  { name: "Kartal", ilce: "Kartal", near: "", km: 52.05, tH: 75, tG: 32, fH: "06:06", lH: "00:43", fG: "06:00", lG: "23:52", akt: "M4, İDO" },
  { name: "Yunus", ilce: "Kartal", near: "", km: 53.83, tH: 78, tG: 29, fH: "06:02", lH: "00:46", fG: "06:05", lG: "23:49", akt: "—" },
  { name: "Pendik", ilce: "Pendik", near: "", km: 55.79, tH: 81, tG: 26, fH: "06:05", lH: "00:49", fG: "06:02", lG: "23:46", akt: "M4, YHT, İDO" },
  { name: "Kaynarca", ilce: "Pendik", near: "", km: 58.20, tH: 84, tG: 23, fH: "06:08", lH: "00:52", fG: "06:14", lG: "23:43", akt: "—" },
  { name: "Tersane", ilce: "Pendik", near: "", km: 60.16, tH: 86, tG: 21, fH: "06:10", lH: "00:54", fG: "06:12", lG: "23:41", akt: "—" },
  { name: "Güzelyalı", ilce: "Pendik", near: "", km: 61.21, tH: 88, tG: 19, fH: "06:12", lH: "00:56", fG: "06:10", lG: "23:39", akt: "—" },
  { name: "Aydıntepe", ilce: "Tuzla", near: "", km: 62.23, tH: 90, tG: 17, fH: "06:14", lH: "00:58", fG: "06:08", lG: "23:37", akt: "—" },
  { name: "İçmeler", ilce: "Tuzla", near: "", km: 63.22, tH: 92, tG: 15, fH: "06:16", lH: "01:00", fG: "06:06", lG: "23:35", akt: "M4" },
  { name: "Tuzla", ilce: "Tuzla", near: "", km: 65.92, tH: 95, tG: 12, fH: "06:19", lH: "01:03", fG: "06:03", lG: "23:32", akt: "—" },
  { name: "Çayırova", ilce: "Gebze", near: "", km: 69.13, tH: 98, tG: 8, fH: "06:22", lH: "01:06", fG: "06:13", lG: "23:28", akt: "—" },
  { name: "GTÜ-Fatih", ilce: "Gebze", near: "Gebze Teknik Üniversitesi", km: 70.65, tH: 101, tG: 6, fH: "06:25", lH: "01:09", fG: "06:11", lG: "23:26", akt: "—" },
  { name: "Osmangazi", ilce: "Darıca", near: "", km: 72.42, tH: 103, tG: 4, fH: "06:27", lH: "01:11", fG: "06:09", lG: "23:24", akt: "—" },
  { name: "Darıca", ilce: "Darıca", near: "", km: 73.80, tH: 105, tG: 2, fH: "06:29", lH: "01:13", fG: "06:07", lG: "23:22", akt: "—" },
  { name: "Gebze", ilce: "Gebze", near: "Gebze merkez", km: 75.77, tH: 107, tG: 0, fH: "—", lH: "01:15", fG: "06:05", lG: "23:20", akt: "YHT, Bölgesel" },
];

// Marmaray ücret kademeleri (İBB/UKOME 20.07.2026) — 7 durakta bir kademe.
// Uçtan uca 42 durak → 36–43 kademesi = ₺82,17. Doğrulama: kaynaktaki 7 örnek
// güzergâhın 6'sı bu modelle birebir tutuyor (1'inde kaynakta dizgi hatası var).
const B1_FARE = [
  { maxN: 7,  tam: 37.40, ogr: 18.13, sos: 26.58 },
  { maxN: 14, tam: 47.74, ogr: 22.32, sos: 32.92 },
  { maxN: 21, tam: 55.11, ogr: 26.58, sos: 38.72 },
  { maxN: 28, tam: 63.56, ogr: 30.23, sos: 45.08 },
  { maxN: 35, tam: 74.24, ogr: 35.53, sos: 53.02 },
  { maxN: 43, tam: 82.17, ogr: 37.13, sos: 57.29 },
];

const M11_FAQ = [
  { q: "Gayrettepe'den İstanbul Havalimanı'na metro kaç dakika?",
    a: "M11 ile Gayrettepe'den İstanbul Havalimanı'na yaklaşık 30 dakikada, 6 durak sonra ulaşılır. Tam ücret 42,34 TL'dir." },
  { q: "Halkalı'dan İstanbul Havalimanı'na kaç dakika?",
    a: "Halkalı'dan İstanbul Havalimanı'na M11 ile yaklaşık 33 dakika sürer ve 8 durak geçilir. Tam ücret 47,89 TL'dir." },
  { q: "M11 metro ücreti ne kadar? (2026)",
    a: "20 Temmuz 2026 tarifesine göre ücret gidilen durak sayısına göre 37,40 TL ile 66,39 TL (tam) arasında değişir. Girişte en yüksek ücret alınır, çıkışta gidilmeyen mesafe iade edilir." },
  { q: "M11 kaç dakikada bir geçiyor?",
    a: "Gündüz seferleri yaklaşık 15-20 dakikada birdir. Cuma ve Cumartesi geceleri 00:01-05:30 arasında 30 dakikada bir ek sefer yapılır; gece seferlerinde çift ücret uygulanır." },
  { q: "M11 ilk ve son sefer saatleri nedir?",
    a: "Seferler yaklaşık 06:00'da başlar. Son tren Gayrettepe'den 23:55'te kalkıp Halkalı'ya 00:59'da varır; Halkalı'dan son tren 23:44'te kalkar." },
  { q: "Halkalı - İstanbul Havalimanı metrosu ücretsiz mi?",
    a: "31 Temmuz 2026 tarihine kadar İbn Haldun Üniversitesi, Kayaşehir, Olimpiyatköy, Halkalı Stadı ve Halkalı istasyonlarından biniş ücretsizdir; diğer istasyonlardan biniş ücretlidir." },
  { q: "İstanbul Havalimanı'ndan Üsküdar'a veya Kadıköy'e nasıl gidilir?",
    a: "M11 ile Halkalı'ya gidilir (33 dakika, 8 durak), aynı istasyondan Marmaray'a aktarma yapılır. Halkalı'dan Üsküdar'a Marmaray ile 40 dakika sürer. Aktarma payıyla birlikte toplam yaklaşık 85 dakika ve 95,63 TL'dir. Marmaray aktarma indirimi vermediği için iki hattın ücreti ayrı ayrı ödenir." },
  { q: "M11 hangi hatlara aktarma yapıyor?",
    a: "Gayrettepe'de M2 ve Metrobüs, Kâğıthane'de M7, Kayaşehir'de M3, Olimpiyatköy'de M9, Halkalı'da Marmaray, M1 ve Yüksek Hızlı Tren aktarması yapılabilir." },
];

const B1_FAQ = [
  { q: "Marmaray Halkalı'dan Gebze'ye kaç dakika?",
    a: "Marmaray ile Halkalı'dan Gebze'ye uçtan uca yaklaşık 107 dakikada, 42 durak geçilerek ulaşılır. Tam ücret 82,17 TL'dir." },
  { q: "Marmaray ücreti ne kadar? (2026)",
    a: "20 Temmuz 2026 tarifesine göre ücret gidilen durak sayısına göre 37,40 TL ile 82,17 TL (tam) arasında değişir. Her 7 durakta bir üst kademeye geçilir." },
  { q: "Marmaray kaç dakikada bir geçiyor?",
    a: "Halkalı – Gebze uçtan uca seferler 15 dakikada bir, yoğun kesim olan Ataköy – Pendik arası ise 8 dakikada bir yapılır. Kapanış ve hafta sonu gece seferleri 30 dakikada birdir." },
  { q: "Marmaray ilk ve son sefer saatleri nedir?",
    a: "Halkalı'dan ilk tren 05:58'de, Gebze'den 06:05'te kalkar. Son tren Halkalı'dan 23:28'de, Gebze'den 23:20'de hareket eder; hafta sonu gece seferleri 01:20'ye kadar sürer." },
  { q: "Marmaray'da kaç istasyon var?",
    a: "Halkalı ile Gebze arasındaki 75,8 km'lik hatta 43 istasyon bulunur; 38'i İstanbul'da, 5'i Kocaeli'ndedir." },
  { q: "Marmaray hangi hatlara aktarma yapıyor?",
    a: "Yenikapı'da M1, M2 ve T1; Üsküdar'da M5; Ayrılık Çeşmesi, Bostancı, Kartal ve Pendik'te M4; Bakırköy'de M3; Ataköy'de M9; Sirkeci'de T1; Küçükçekmece ve Söğütlüçeşme'de Metrobüs; Halkalı'da M11 ve YHT aktarması yapılabilir." },
  { q: "Marmaray'dan İstanbul Havalimanı'na nasıl gidilir?",
    a: "Marmaray ile Halkalı'ya gidip aynı istasyondan M11 metrosuna aktarma yapılır. Halkalı'dan İstanbul Havalimanı'na M11 ile 33 dakika sürer, tam ücret 47,89 TL'dir. Üsküdar'dan toplam yaklaşık 84 dakika ve 95,63 TL, Söğütlüçeşme'den 91 dakika ve 103,00 TL tutar." },
  { q: "Marmaray ile M11 arasında aktarma indirimi var mı?",
    a: "Hayır. Marmaray aktarma vermeyen bir ana hat olarak işletilir; Halkalı'da M11'e geçtiğinizde iki hattın ücreti ayrı ayrı tahsil edilir. Her iki hat da girişte en yüksek ücreti alıp çıkışta gidilmeyen mesafeyi iade eder." },
];

// --- Hatlar -----------------------------------------------------------------
const LINES = {
  m11: {
    id: "m11", code: "M11", path: "/m11", stations: M11_STATIONS, fares: M11_FARE, free: M11_FREE,
    dirTo: "Halkalı yönü", dirFrom: "Gayrettepe yönü",
    title: "İstanbul Havalimanı Metrosu M11 — Süre, Ücret ve Sefer Saatleri 2026 · Gayrettepe · Halkalı",
    desc: "İstanbul Havalimanı metrosu (M11) ile iki istasyon arası kaç dakika, kaç TL? Marmaray aktarmalı rotalar dahil: Havalimanı – Üsküdar, Havalimanı – Söğütlüçeşme. Güncel 2026 süreler, sefer saatleri ve resmî ücret tarifesi.",
    ogTitle: "İstanbul Havalimanı Metrosu M11 — Süre, Ücret & Sefer Saatleri 2026",
    ogDesc: "M11 hattında iki istasyon arası süre, mesafe ve güncel ücret. Sefer saatleri, durak listesi ve ücret tarifesi tek sayfada.",
    appName: "M11 Metro Süre ve Ücret Hesaplayıcı",
    kicker: "M11 Hattı · İstanbul Metrosu<b>İstanbul Havalimanı Metro Rehberi</b>",
    lede: "M11 ve Marmaray'ın 57 istasyonu arasında yolculuğunu seç; süreyi, durak sayısını, aktarmayı ve güncel 2026 ücretini anında gör. Halkalı aktarmalı rotalar otomatik hesaplanır.",
    facts: "<span><b>69</b> km hat</span><span><b>15</b> istasyon</span><span><b>120</b> km/s</span><span>Güncel <b>2026</b> verisi</span>",
    popular: [["m11:0", "m11:6"], ["m11:14", "m11:6"], ["m11:6", "b1:14"], ["m11:6", "b1:16"]], faq: M11_FAQ,
  },
  b1: {
    id: "b1", code: "B1", path: "/marmaray", stations: B1_STATIONS, fares: B1_FARE, free: [],
    dirTo: "Gebze yönü", dirFrom: "Halkalı yönü",
    title: "Marmaray Süre, Ücret ve Sefer Saatleri 2026 — Halkalı · Gebze Durak Hesaplama",
    desc: "Marmaray (B1) ile iki istasyon arası kaç dakika, kaç TL? 43 durak, güncel 2026 ücret tarifesi ve sefer saatleri. M11 aktarmalı rotalar dahil: Üsküdar – İstanbul Havalimanı. Halkalı – Yenikapı – Söğütlüçeşme – Gebze.",
    ogTitle: "Marmaray — Süre, Ücret & Sefer Saatleri 2026 (Halkalı – Gebze)",
    ogDesc: "Marmaray hattında iki durak arası süre, mesafe ve güncel ücret. 43 istasyon, sefer saatleri ve ücret tarifesi tek sayfada.",
    appName: "Marmaray Süre ve Ücret Hesaplayıcı",
    kicker: "Marmaray B1 · Banliyö Treni<b>Halkalı – Gebze Rehberi</b>",
    lede: "Marmaray ve M11'in 57 istasyonu arasında yolculuğunu seç; süreyi, durak sayısını, aktarmayı ve güncel 2026 ücretini anında gör. Halkalı aktarmalı rotalar otomatik hesaplanır.",
    facts: "<span><b>76</b> km hat</span><span><b>43</b> istasyon</span><span><b>108</b> dk uçtan uca</span><span>Güncel <b>2026</b> verisi</span>",
    popular: [["b1:0", "b1:42"], ["b1:12", "b1:16"], ["b1:14", "m11:6"], ["b1:16", "m11:6"]], faq: B1_FAQ,
  },
};
const OTHER = { m11: "b1", b1: "m11" };

// Aktarma noktası: iki hat yalnızca Halkalı'da buluşuyor.
// HUB[hat] = o hattaki Halkalı'nın indeksi. Yeni hat eklenirse burası
// bir kenar listesine dönüşmeli; iki hat için tek nokta yeterli.
const HUB = { m11: 14, b1: 0 };
// Sefer aralıkları (dk) — aktarma beklemesi bundan tahmin edilir.
const HEADWAY = { m11: 15, b1: 15 };
// Halkalı içinde M11 ↔ Marmaray peronları arası yürüme payı (dk, tahmini)
const TRANSFER_WALK = 4;

// Ağ genelinde istasyon kimliği: "hat:indeks". Halkalı iki hatta da var,
// tek düğüm olarak "m11:14" ile temsil edilir.
const NODE_ID = (line, i) => line + ":" + i;
const HUB_ID = NODE_ID("m11", HUB.m11);

// Sunucu tarafı rota planlayıcı — istemcideki route()/calc() ile aynı mantık.
function fareOn(line, n) { const F = LINES[line].fares; for (const f of F) if (n <= f.maxN) return f; return F[F.length - 1]; }
function nodeOf(id) { const [l, i] = id.split(":"); return { l, i: +i }; }
function planRoute(aId, bId) {
  const a = nodeOf(aId), b = nodeOf(bId);
  const legs = a.l === b.l
    ? [{ l: a.l, i: a.i, j: b.i }]
    : [{ l: a.l, i: a.i, j: HUB[a.l] }, { l: b.l, i: HUB[b.l], j: b.i }].filter(g => g.i !== g.j);
  let time = 0, stops = 0, fare = 0;
  legs.forEach((g, k) => {
    const St = LINES[g.l].stations;
    time += g.j > g.i ? (St[g.j].tH - St[g.i].tH) : (St[g.j].tG - St[g.i].tG);
    const n = Math.abs(g.i - g.j);
    stops += n; fare += fareOn(g.l, n).tam;
    if (k > 0) time += TRANSFER_WALK + Math.round(HEADWAY[g.l] / 2);
  });
  return { legs, time, stops, fare, xfer: legs.length - 1,
           from: LINES[a.l].stations[a.i].name, to: LINES[b.l].stations[b.i].name };
}

// --- Yardımcılar (sunucu tarafı: SEO içerikleri önceden hesaplamak için) ----
function lira(v) { return "₺" + v.toFixed(2).replace(".", ","); }


// ===========================================================================
// AĞ PLANLAYICI  —  metro + Marmaray + Metrobüs, saat girişli
// ---------------------------------------------------------------------------
// Veri: İBB Metro İstanbul API (istasyon + koordinat), TCDD tarifeleri (M11 ve
// Marmaray gerçek son-tren tarifesinden), marmaray.istanbul (ücret kademeleri,
// istasyon adları). Aktarmalar istasyon koordinatlarından 400 m eşiğiyle
// bulundu; yürüme süresi mesafeden (80 m/dk) hesaplandı.
//
// SÜRE VERİSİNİN KAYNAĞI HATTA GÖRE DEĞİŞİR:
//   M11 & Marmaray  → gerçek tarifeden türetilmiş (istasyon istasyon)
//   metro & metrobüs → hat toplam süresinin mesafeye orantılı dağıtımı (TAHMİN)
// Bu ayrım arayüzde de belirtilir; uydurulmuş kesinlik iddiası yoktur.
const NETWORK = {"L":{"M1A":{"n":["Yenikapı","Aksaray","Emniyet – Fatih","Topkapı – Ulubatlı","Bayrampaşa – Maltepe","Sağmalcılar","Kocatepe","Otogar","Terazidere","Davutpaşa – YTÜ","Merter","Zeytinburnu","Bakırköy – İncirli","Bahçelievler","Ataköy – Şirinevler","Yenibosna","DTM – Fuar Merkezi","Atatürk Havalimanı"],"km":[0.0,0.95,1.95,3.05,4.55,5.95,7.34,8.33,9.52,10.68,12.25,13.16,14.56,15.67,17.25,18.12,18.91,19.98],"t":[0,1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33],"h":6,"f":"05:50","l":"00:00","k":"metro","c":"#e11b22","p":[[41.00476,28.95255],[41.01203,28.94806],[41.01761,28.9396],[41.02403,28.9305],[41.0341,28.92024],[41.04085,28.90724],[41.04849,28.89539],[41.04014,28.89456],[41.03033,28.89795],[41.02064,28.90014],[41.00765,28.89618],[41.0017,28.88965],[40.99661,28.8754],[40.99535,28.86307],[40.99135,28.84608],[40.98931,28.8367],[40.98665,28.82855],[40.97954,28.82112]],"src":"gtfs","dA":[0,360,370,380,390,398,406,414,420,426,432,438,444,450,456,462,468,474,480,486,492,498,504,510,516,522,528,534,540,546,552,558,564,570,576,582,588,594,600,606,612,618,624,630,636,642,648,654,660,666,672,678,684,690,696,702,708,714,720,726,732,738,744,750,756,762,768,774,780,786,792,798,804,810,816,822,828,834,840,846,852,858,864,870,876,882,888,894,900,906,912,918,924,930,936,942,948,954,960,966,972,978,984,990,996,1002,1008,1014,1020,1026,1032,1038,1044,1050,1056,1062,1068,1074,1080,1086,1092,1098,1104,1110,1116,1122,1128,1134,1140,1146,1152,1158,1164,1170,1176,1182,1188,1194,1200,1206,1212,1218,1224,1230,1236,1242,1248,1254,1260,1266,1272,1278,1284,1292,1300,1308,1316,1324,1332,1340,1350,1360,1370,1380,1390,1400,1410,1420,1430],"dB":[0,360,370,380,390,398,406,414,420,426,432,438,444,450,456,462,468,474,480,486,493,500,506,512,518,524,530,536,542,548,554,560,566,572,578,584,590,596,602,608,614,620,626,632,638,644,650,656,662,668,674,680,686,692,698,704,710,716,722,728,734,740,746,752,758,764,770,776,782,788,794,800,806,812,818,824,830,836,842,848,854,860,866,872,878,884,890,896,902,908,914,920,926,932,938,944,950,956,962,968,974,980,986,992,998,1004,1010,1016,1022,1028,1034,1040,1046,1052,1058,1064,1070,1076,1082,1088,1094,1100,1106,1112,1118,1124,1130,1136,1142,1148,1154,1160,1166,1172,1178,1184,1190,1196,1202,1208,1214,1220,1226,1232,1238,1244,1250,1256,1264,1272,1280,1288,1296,1304,1312,1320,1328,1337,1347,1357,1367,1377,1387,1397,1407,1417,1427]},"M1B":{"n":["Yenikapı","Aksaray","Emniyet – Fatih","Topkapı – Ulubatlı","Bayrampaşa – Maltepe","Sağmalcılar","Kocatepe","Otogar","Esenler","Menderes","Üçyüzlü","Bağcılar Meydan","Kirazlı"],"km":[0.0,0.95,1.95,3.05,4.55,5.95,7.34,8.33,8.94,10.01,11.01,12.32,13.54],"t":[0,2,3,5,7,9,12,13,15,17,18,20,22],"h":6,"f":"06:00","l":"00:03","k":"metro","c":"#e11b22","p":[[41.00476,28.95255],[41.01203,28.94806],[41.01761,28.9396],[41.02403,28.9305],[41.0341,28.92024],[41.04085,28.90724],[41.04849,28.89539],[41.04014,28.89456],[41.03768,28.88842],[41.04276,28.87849],[41.03672,28.87063],[41.03452,28.85617],[41.0323,28.84277]],"src":"gtfs","dA":[365,375,385,394,402,410,417,423,429,435,441,447,453,459,465,471,477,483,489,495,501,507,513,519,525,531,537,543,549,555,561,567,573,579,585,591,597,603,609,615,621,627,633,639,645,651,657,663,669,675,681,687,693,699,705,711,717,723,729,735,741,747,753,759,765,771,777,783,789,795,801,807,813,819,825,831,837,843,849,855,861,867,873,879,885,891,897,903,909,915,921,927,933,939,945,951,957,963,969,975,981,987,993,999,1005,1011,1017,1023,1029,1035,1041,1047,1053,1059,1065,1071,1077,1083,1089,1095,1101,1107,1113,1119,1125,1131,1137,1143,1149,1155,1161,1167,1173,1179,1185,1191,1197,1203,1209,1215,1221,1227,1233,1239,1245,1251,1257,1263,1269,1275,1281,1288,1296,1304,1312,1320,1328,1336,1345,1355,1365,1375,1385,1395,1405,1415,1425,1435],"dB":[360,368,378,388,398,406,414,420,425,430,435,440,444,448,452,456,460,464,468,472,476,480,485,490,495,501,507,513,519,525,531,537,543,549,555,561,567,573,579,585,591,597,603,609,615,621,627,633,639,645,651,657,663,669,675,681,687,693,699,705,711,717,723,729,735,741,747,753,759,765,771,777,783,789,795,801,807,813,819,825,831,837,843,849,855,861,867,873,879,885,891,897,903,909,915,921,927,933,939,945,951,957,963,969,975,981,987,993,999,1005,1011,1017,1023,1029,1035,1041,1047,1053,1059,1065,1071,1077,1083,1089,1095,1101,1107,1113,1119,1125,1131,1137,1143,1149,1155,1161,1167,1173,1179,1185,1191,1197,1203,1209,1215,1221,1227,1233,1239,1245,1251,1257,1263,1270,1278,1286,1294,1302,1310,1318,1326,1334,1342,1352,1362,1372,1382,1392,1402,1412,1422,1432]},"M2":{"n":["Yenikapı","Vezneciler","Haliç","Şişhane","Taksim","Osmanbey","Mecidiyeköy","Gayrettepe","Levent","4. Levent","Sanayi Mahallesi","Seyrantepe","İTÜ – Ayazağa","Atatürk Oto Sanayi","Darüşşafaka","Hacıosman"],"km":[0.0,1.08,2.47,3.37,5.03,6.74,8.18,9.89,10.84,12.07,13.07,14.09,16.31,17.54,18.88,20.17],"t":[0,2,4,6,8,11,13,15,17,19,20,22,23,25,27,29],"h":3,"f":"05:57","l":"00:00","k":"metro","c":"#00a04b","p":[[41.0056,28.95133],[41.01147,28.96071],[41.02244,28.96642],[41.0283,28.97285],[41.0385,28.98578],[41.05295,28.98738],[41.06451,28.99267],[41.069,29.01092],[41.07677,29.01369],[41.08601,29.00709],[41.09432,29.00534],[41.10091,28.99778],[41.10809,29.02079],[41.11826,29.02419],[41.12958,29.02512],[41.13977,29.03043]],"src":"gtfs","dA":[360,364,365,372,377,383,389,396,401,407,413,420,424,426,428,431,434,436,439,442,445,448,450,453,456,459,462,465,467,470,473,476,478,481,484,487,490,492,495,498,501,504,506,509,512,515,518,520,523,526,529,532,534,537,540,543,546,548,551,554,557,560,562,565,568,571,574,576,579,582,585,588,590,593,596,599,602,604,609,613,617,621,625,629,633,637,641,645,649,653,657,662,666,670,674,678,682,686,690,694,698,702,706,710,714,718,722,726,730,734,738,743,747,751,755,759,763,767,771,775,779,783,787,791,795,799,803,807,811,815,819,824,828,832,836,840,844,847,850,854,857,861,865,868,872,875,879,882,886,889,893,896,900,903,907,910,914,917,921,924,928,931,935,938,942,945,949,952,956,959,963,966,969,971,974,977,980,983,985,988,991,994,997,999,1002,1005,1008,1011,1013,1016,1019,1022,1025,1027,1030,1033,1036,1039,1041,1044,1047,1050,1053,1055,1058,1061,1064,1067,1069,1072,1075,1078,1081,1083,1086,1089,1092,1095,1097,1100,1103,1106,1109,1111,1114,1117,1120,1123,1125,1128,1131,1134,1137,1139,1142,1145,1148,1151,1153,1156,1159,1162,1165,1167,1170,1173,1176,1179,1181,1184,1187,1190,1193,1195,1198,1201,1204,1209,1214,1219,1223,1228,1233,1238,1243,1248,1253,1258,1263,1268,1273,1278,1282,1287,1292,1297,1302,1309,1317,1323,1332,1339,1345,1352,1359,1366,1373,1380,1387,1394,1401,1410,1420,1430],"dB":[357,364,369,375,381,388,392,401,406,409,412,415,418,420,423,426,430,431,434,437,441,443,446,448,452,454,457,460,462,465,468,471,474,476,479,482,485,488,490,493,496,499,502,504,507,510,513,516,518,521,524,527,530,532,535,538,541,544,546,549,552,555,558,560,563,566,569,573,577,581,585,589,593,597,601,605,609,613,617,621,626,630,634,638,642,646,650,654,658,662,666,670,674,678,682,686,690,694,698,702,707,711,715,719,723,727,731,735,739,743,747,751,755,759,763,767,771,775,779,783,788,792,796,800,804,808,811,815,818,822,825,829,832,836,839,843,846,850,853,857,861,864,868,871,875,878,882,885,889,892,896,899,903,906,910,913,917,920,924,927,930,933,939,941,944,947,953,955,958,961,967,969,972,975,981,983,986,989,995,997,1000,1003,1006,1009,1011,1014,1017,1020,1023,1025,1028,1031,1034,1037,1039,1042,1045,1048,1051,1053,1056,1059,1062,1065,1067,1070,1073,1076,1079,1081,1084,1087,1090,1093,1095,1098,1101,1104,1107,1109,1112,1115,1118,1121,1123,1126,1129,1132,1135,1137,1140,1143,1146,1149,1151,1154,1157,1160,1163,1165,1168,1173,1178,1183,1188,1193,1198,1203,1207,1212,1217,1222,1227,1232,1237,1242,1247,1252,1257,1262,1266,1271,1276,1281,1286,1291,1296,1303,1310,1317,1324,1331,1337,1346,1351,1360,1365,1372,1379,1386,1393,1400,1410,1420,1430]},"M3":{"n":["Bakırköy Sahil","Özgürlük Meydanı","İncirli","Haznedar","İlkyuva","Yıldıztepe","Molla Gürani","Kirazlı","Yenimahalle","Mahmutbey","İSTOÇ","İkitelli Sanayi","Turgut Özal","Siteler","Başak Konutları","Başakşehir-Metrokent","Onurkent","Şehir Hastanesi","Toplu Konutlar","Kayaşehir Merkez"],"km":[0.0,1.08,2.93,4.06,4.8,6.06,7.08,8.01,9.14,10.91,12.17,14.45,15.57,16.4,17.61,19.09,20.3,21.92,22.93,24.41],"t":[0,2,4,7,9,11,13,15,17,20,22,25,27,28,30,32,34,36,38,41],"h":8,"f":"06:00","l":"00:00","k":"metro","c":"#00adef","p":[[40.97381,28.86809],[40.98185,28.87389],[40.9975,28.87515],[41.00643,28.87053],[41.01175,28.86599],[41.01977,28.85672],[41.02551,28.84811],[41.0323,28.84277],[41.04036,28.83594],[41.05484,28.83052],[41.065,28.82596],[41.07243,28.80233],[41.08119,28.7974],[41.0882,28.79651],[41.09767,28.79128],[41.10759,28.80148],[41.11351,28.79035],[41.10346,28.77786],[41.1076,28.76788],[41.12006,28.76664]],"src":"gtfs","dA":[345,355,365,375,385,395,405,412,419,425,430,435,440,445,450,455,460,465,470,475,480,485,491,498,505,511,518,525,531,538,545,551,558,565,571,579,587,595,603,611,619,627,635,643,651,659,667,675,683,691,699,707,715,723,731,739,747,755,763,771,779,787,795,803,811,819,827,835,843,851,859,867,875,883,891,899,907,915,923,931,939,947,955,963,971,979,987,995,1003,1011,1019,1027,1033,1040,1047,1053,1060,1067,1073,1080,1087,1093,1100,1107,1113,1120,1127,1133,1140,1147,1153,1160,1167,1173,1180,1187,1193,1200,1207,1215,1223,1231,1239,1247,1255,1263,1271,1279,1287,1295,1305,1315,1325,1335,1345,1355,1365,1375,1385,1395,1410],"dB":[351,361,371,381,388,396,403,411,416,421,426,431,436,441,446,451,456,461,466,471,477,484,491,497,504,511,517,524,531,537,544,551,557,565,573,581,589,597,605,613,621,629,637,645,653,661,669,677,685,693,701,709,717,725,733,741,749,757,765,773,781,789,797,805,813,821,829,837,845,853,861,869,877,885,893,901,909,917,925,933,941,949,957,965,973,981,989,997,1005,1013,1019,1026,1033,1039,1046,1053,1059,1066,1073,1079,1086,1093,1099,1106,1113,1119,1126,1133,1139,1146,1153,1159,1166,1173,1179,1186,1193,1201,1209,1217,1225,1233,1241,1249,1257,1265,1273,1281,1291,1301,1311,1321,1331,1341,1351,1361,1371,1381,1391,1406,1416]},"M4":{"n":["Kadıköy","Ayrılık Çeşmesi","Acıbadem","Ünalan","Göztepe","Yenisahra","Pegasus-Kozyatağı","Bostancı","Küçükyalı","Maltepe","Huzurevi","Gülsuyu","Esenkent[2]","Hastane – Adliye","Soğanlık","Kartal","Yakacık-Adnan Kahveci","Pendik","Tavşantepe","Fevzi Çakmak-Hastane","Yayalar – Şeyhli","Kurtköy","Sabiha Gökçen Havalimanı"],"km":[0.0,1.34,2.64,4.23,5.16,7.2,8.65,9.92,12.49,14.33,15.51,16.63,17.58,18.77,20.12,21.89,23.74,25.14,26.31,27.77,29.94,31.97,33.29],"t":[0,2,4,7,8,11,13,15,18,21,23,24,26,28,30,32,34,37,38,40,42,44,46],"h":5,"f":"06:00","l":"23:59","k":"metro","c":"#e56db1","p":[[40.99066,29.02201],[41.0002,29.03015],[41.00233,29.0445],[40.99789,29.06137],[40.99393,29.07045],[40.98497,29.09013],[40.97485,29.09933],[40.96484,29.1046],[40.94848,29.12371],[40.93649,29.13681],[40.92996,29.14695],[40.92389,29.15655],[40.92059,29.1663],[40.91631,29.17843],[40.91279,29.19284],[40.90682,29.21103],[40.89673,29.22696],[40.88839,29.23817],[40.88226,29.24857],[40.88891,29.26238],[40.90415,29.27593],[40.91062,29.29706],[40.90597,29.31055]],"src":"gtfs","dA":[2,360,368,375,382,388,395,402,409,416,423,429,436,443,448,452,457,461,466,470,475,480,484,489,493,498,502,506,511,515,519,524,528,532,536,541,545,549,554,558,562,567,571,575,579,583,589,595,601,606,612,618,623,629,635,640,646,652,658,663,669,675,680,686,692,697,703,709,715,720,726,732,737,743,749,754,760,766,772,777,783,789,794,800,806,811,817,823,829,834,840,846,851,857,863,868,874,880,886,891,897,903,908,914,920,925,931,937,943,948,954,959,964,969,973,978,982,987,991,996,1001,1005,1010,1014,1019,1023,1028,1032,1037,1041,1046,1051,1055,1060,1064,1069,1073,1078,1082,1087,1092,1096,1101,1105,1110,1114,1119,1123,1128,1132,1137,1142,1146,1151,1155,1160,1164,1169,1173,1178,1183,1187,1192,1196,1201,1205,1210,1214,1219,1223,1228,1233,1237,1244,1251,1258,1265,1272,1278,1287,1295,1303,1311,1319,1328,1336,1344,1352,1360,1369,1377,1385,1393,1401,1410,1418,1426,1434],"dB":[352,360,368,376,384,392,398,403,408,412,417,421,426,430,435,439,444,448,453,458,462,467,471,476,480,485,489,494,499,503,508,512,517,521,526,530,535,539,543,547,552,556,560,565,569,575,581,586,592,598,603,609,615,621,626,632,638,643,649,655,660,666,672,678,683,689,695,700,706,712,717,723,729,735,740,746,752,757,763,769,774,780,786,792,797,803,809,814,820,826,831,837,843,849,854,860,866,871,877,883,888,894,900,905,910,915,919,924,929,934,939,944,948,953,958,963,968,972,977,982,987,992,997,1001,1006,1010,1015,1020,1024,1029,1033,1038,1042,1047,1051,1056,1060,1065,1070,1074,1079,1083,1088,1092,1097,1101,1106,1111,1115,1120,1124,1129,1133,1138,1142,1147,1151,1156,1161,1165,1170,1174,1179,1183,1188,1195,1202,1208,1215,1222,1229,1236,1243,1249,1256,1263,1270,1277,1284,1290,1297,1304,1311,1319,1327,1336,1344,1352,1360,1368,1377,1385,1393,1401,1409,1418,1426]},"M5":{"n":["Üsküdar","Fıstıkağacı","Bağlarbaşı","Altunizade","Kısıklı","Bulgurlu","Ümraniye","Çarşı","Yamanevler","Çakmak","Ihlamurkuyu","Altınşehir","İmam Hatip Lisesi","Dudullu","Necip Fazıl","Çekmeköy","Meclis","Sarıgazi","Sancaktepe Şehir Hastanesi","Sancaktepe","Samandıra Merkez","Veysel Karani","Hasanpaşa","Sultanbeyli"],"km":[0.0,1.24,2.23,3.11,4.66,6.05,7.31,8.41,9.47,10.36,11.54,12.26,13.49,14.39,15.89,16.81,17.82,19.01,20.04,21.74,22.64,22.64,22.64,22.64],"t":[0,3,4,6,8,10,12,14,16,17,19,20,22,23,25,27,29,31,32,34,36,38,40,41],"h":8,"f":"06:00","l":"00:01","k":"metro","c":"#8e4b9e","p":[[41.02562,29.01506],[41.02817,29.02855],[41.02149,29.03539],[41.02257,29.04516],[41.02224,29.06259],[41.01638,29.07613],[41.02475,29.08491],[41.0259,29.09719],[41.02436,29.10893],[41.02165,29.11832],[41.01939,29.13128],[41.01683,29.13862],[41.01619,29.15244],[41.01544,29.16245],[41.01621,29.17929],[41.01457,29.18945],[41.00973,29.19883],[41.01031,29.21212],[41.00227,29.21681],[40.99134,29.22925],[40.9839,29.23141],[40.9839,29.23141],[40.9839,29.23141],[40.9839,29.23141]],"src":"gtfs","dA":[360,368,376,384,392,400,408,416,424,432,440,448,456,464,472,480,488,496,504,512,520,528,536,544,552,560,568,576,584,592,600,608,616,624,632,640,648,656,664,672,680,688,696,704,712,720,728,736,744,752,760,768,776,784,792,800,808,816,824,832,840,848,856,864,872,880,888,896,904,912,920,928,936,944,952,960,968,976,984,992,1000,1008,1016,1024,1032,1040,1048,1056,1064,1072,1080,1088,1096,1104,1112,1120,1128,1136,1144,1152,1160,1168,1176,1184,1192,1200,1208,1216,1224,1232,1240,1248,1256,1264,1272,1280,1288,1296,1304,1312,1320,1328,1336,1344,1352,1360,1368,1376,1384,1392,1400,1408,1416,1424,1432,1439],"dB":[346,354,362,370,378,386,394,402,410,418,426,434,442,450,458,466,474,482,490,498,506,514,522,530,538,546,554,562,570,578,586,594,602,610,618,626,634,642,650,658,666,674,682,690,698,706,714,722,730,738,746,754,762,770,778,786,794,802,810,818,826,834,842,850,858,866,874,882,890,898,906,914,922,930,938,946,954,962,970,978,986,994,1002,1010,1018,1026,1034,1042,1050,1058,1066,1074,1082,1090,1098,1106,1114,1122,1130,1138,1146,1154,1162,1170,1178,1186,1194,1202,1210,1218,1226,1234,1242,1250,1258,1266,1274,1282,1290,1298,1306,1314,1322,1330,1338,1346,1354,1362,1370,1378,1386,1394,1402,1410,1418,1425]},"M6":{"n":["Levent","Nispetiye","Etiler","Hisarustu-Bogazici Universitesi"],"km":[0.0,0.76,2.22,3.0],"t":[0,2,5,8],"h":9,"f":"06:00","l":"23:59","k":"metro","c":"#c9a227","p":[[41.07589,29.01414],[41.07769,29.02236],[41.08239,29.03759],[41.08528,29.04552]],"src":"gtfs","dA":[0,360,369,378,387,396,405,414,423,432,441,450,459,468,477,486,495,504,513,522,531,540,549,558,567,576,585,594,603,612,621,630,639,648,657,666,675,684,693,702,711,720,729,738,747,756,765,774,783,792,801,810,819,828,837,846,855,864,873,882,891,900,909,918,927,936,945,954,963,972,981,990,999,1008,1017,1026,1035,1044,1053,1062,1071,1080,1089,1098,1107,1116,1125,1134,1143,1152,1161,1170,1179,1188,1197,1206,1215,1224,1233,1242,1251,1260,1269,1278,1287,1296,1305,1314,1323,1332,1341,1350,1359,1368,1377,1386,1395,1404,1413,1422,1431],"dB":[-3,355,364,373,382,391,400,409,418,427,436,445,454,463,472,481,490,499,508,517,526,535,544,553,562,571,580,589,598,607,616,625,634,643,652,661,670,679,688,697,706,715,724,733,742,751,760,769,778,787,796,805,814,823,832,841,850,859,868,877,886,895,904,913,922,931,940,949,958,967,976,985,994,1003,1012,1021,1030,1039,1048,1057,1066,1075,1084,1093,1102,1111,1120,1129,1138,1147,1156,1165,1174,1183,1192,1201,1210,1219,1228,1237,1246,1255,1264,1273,1282,1291,1300,1309,1318,1327,1336,1345,1354,1363,1372,1381,1390,1399,1408,1417,1426,1435]},"M7":{"n":["Yıldız","Fulya","Mecidiyeköy","Çağlayan","Kâğıthane","Nurtepe","Alibeyköy","Çırçır","Veysel Karani – Akşemsettin","Yeşilpınar","Kâzım Karabekir","Yenimahalle","Karadeniz Mahallesi","Giyimkent – Tekstilkent","Oruç Reis","Göztepe Mahallesi","Mahmutbey"],"km":[0.0,0.8,2.03,3.47,4.7,5.53,6.74,7.78,8.5,9.01,11.47,12.85,14.45,15.88,17.26,18.21,19.95],"t":[0,1,4,6,9,10,13,14,16,17,21,24,27,29,32,34,37],"h":6,"f":"06:00","l":"23:59","k":"metro","c":"#e2338a","p":[[41.05546,29.0098],[41.06195,29.00724],[41.06614,28.99458],[41.07124,28.97979],[41.07997,28.97225],[41.07964,28.96295],[41.07917,28.94936],[41.07985,28.93762],[41.07969,28.92956],[41.07999,28.93527],[41.08546,28.90855],[41.08372,28.89311],[41.0816,28.87542],[41.0713,28.86688],[41.06338,28.85544],[41.0564,28.84997],[41.05431,28.83061]]},"M8":{"n":["Bostancı","Emin Ali Paşa","Ayşekadın","Kozyatağı","Küçükbakkalköy","İçerenköy","Kayışdağı","Mevlana","İmes","Modoko-Keyap","Dudullu","Huzur","Parseller"],"km":[0.0,1.13,2.09,3.55,4.81,6.12,7.33,8.98,9.91,10.96,11.9,12.76,14.02],"t":[0,2,4,7,9,11,14,17,18,20,22,24,26],"h":6,"f":"06:00","l":"00:00","k":"metro","c":"#8d6e3a","p":[[40.95129,29.09724],[40.96055,29.09385],[40.96673,29.08686],[40.97525,29.09881],[40.97913,29.112],[40.97912,29.12667],[40.98552,29.13729],[40.99237,29.15356],[40.99995,29.15606],[41.00762,29.16218],[41.01557,29.1625],[41.0225,29.15945],[41.03188,29.15269]]},"M9":{"n":["Ataköy","Yenibosna","Çobançeşme","29 Ekim – Cumhuriyet","Doğu Sanayi","Mimar Sinan","15 Temmuz","Halkalı Caddesi","Atatürk Mahallesi","Bahariye","Masko","İkitelli Sanayi","Ziya Gökalp Mahallesi","Olimpiyat"],"km":[0.0,1.98,3.8,4.65,5.67,6.88,8.28,9.52,10.62,11.31,12.11,12.96,14.53,16.23],"t":[0,4,7,9,10,13,15,18,20,21,22,24,27,30],"h":6,"f":"06:00","l":"00:00","k":"metro","c":"#f5a01d","p":[[40.97992,28.85622],[40.98947,28.83796],[40.99971,28.82259],[41.00621,28.8186],[41.01489,28.81799],[41.02508,28.81655],[41.03686,28.81416],[41.04553,28.80634],[41.05289,28.79865],[41.05869,28.79922],[41.06435,28.80415],[41.07159,28.80359],[41.07469,28.78643],[41.07979,28.76849]]},"M11":{"n":["Gayrettepe","Kâğıthane","Hasdal","Kemerburgaz","Göktürk","İhsaniye","İstanbul Havalimanı","Kargo Terminali","Taşoluk","Arnavutköy Hastane","İbn Haldun Üniversitesi","Kayaşehir","Olimpiyatköy","Halkalı Stadı","Halkalı"],"km":[0,3.94,9.43,15.03,18.16,28.11,34.1,36.61,43.01,47.34,54.24,58.05,62.48,64.95,69.11],"t":[0,4,9,13,17,24,30,34,39,43,49,52,57,60,64],"h":15,"f":"05:55","l":"23:55","k":"tcdd","c":"#00a3a3","fare":[[3,37.4,18.13,26.58],[6,42.34,20.8,30.45],[8,47.89,23.39,34.16],[10,53.74,25.97,37.87],[12,59.9,28.55,41.58],[14,66.39,31.13,45.3]],"p":[[41.06664,29.01181],[41.08023,28.97618],[41.12136,28.94689],[41.15947,28.91022],[41.17683,28.88379],[41.24286,28.80899],[41.256,28.74261],[41.25538,28.71276],[41.20597,28.71621],[41.17929,28.74774],[41.13965,28.79385],[41.11749,28.76574],[41.07855,28.76951],[41.05629,28.77441],[41.01976,28.768]],"dA":[355,370,385,400,415,430,445,460,475,490,505,520,535,550,565,580,595,610,625,640,655,670,685,700,715,730,745,760,775,790,805,820,835,850,865,880,895,910,925,940,955,970,985,1000,1015,1030,1045,1060,1075,1090,1105,1120,1135,1150,1165,1180,1195,1210,1225,1240,1255,1270,1285,1300,1315,1330,1345,1360,1375,1390,1405,1420,1435],"dB":[360,375,390,405,420,435,450,465,480,495,510,525,540,555,570,585,600,615,630,645,660,675,690,705,720,735,750,765,780,795,810,825,840,855,870,885,900,915,930,945,960,975,990,1005,1020,1035,1050,1065,1080,1095,1110,1125,1140,1155,1170,1185,1200,1215,1230,1245,1260,1275,1290,1305,1320,1335,1350,1365,1380,1395,1410],"src":"tcdd"},"Marmaray":{"n":["Halkalı","Mustafa Kemal","Küçükçekmece","Florya","Florya Akvaryum","Yeşilköy","Yeşilyurt","Ataköy","Bakırköy","Yenimahalle","Zeytinburnu-Fişekhane","Kazlıçeşme","Yenikapı","Sirkeci","Üsküdar","Ayrılık Çeşmesi","Söğütlüçeşme","Feneryolu","Göztepe","Erenköy","Suadiye","Bostancı","Küçükyalı","İdealtepe","Süreyya Plajı","Maltepe","Cevizli","Atalar","Başak","Kartal","Yunus","Pendik","Kaynarca","Tersane","Güzelyalı","Aydıntepe","İçmeler","Tuzla","Çayırova","GTÜ-Fatih","Osmangazi","Darıca","Gebze"],"km":[0,1.59,3.65,5.92,6.95,9.51,10.64,13.08,14.54,15.32,17.55,18.86,22.27,24.74,28.35,31.68,32.96,34.7,35.94,37.46,38.95,40.1,41.58,42.75,44.33,45.45,47.75,49.63,50.81,52.05,53.83,55.79,58.2,60.16,61.21,62.23,63.22,65.92,69.13,70.65,72.42,73.8,75.77],"t":[0,3,5,8,10,13,15,18,21,23,26,28,32,35,39,43,46,48,50,52,55,57,60,62,64,66,69,71,73,75,78,81,84,86,88,90,92,95,98,101,103,105,107],"h":15,"f":"05:58","l":"23:28","k":"tcdd","c":"#0a5c9e","fare":[[7,37.4,18.13,26.58],[14,47.74,22.32,32.92],[21,55.11,26.58,38.72],[28,63.56,30.23,45.08],[35,74.24,35.53,53.02],[43,82.17,37.13,57.29]],"p":[[41.01833,28.76639],[41.00611,28.77389],[40.98861,28.77306],[40.97278,28.7875],[40.96784,28.79698],[40.96265,28.82492],[40.96534,28.83708],[40.98022,28.85619],[40.98028,28.8725],[40.98167,28.88111],[40.98583,28.90556],[40.99278,28.91694],[41.00556,28.95139],[41.01361,28.97699],[41.02583,29.01417],[41.00028,29.03],[40.99111,29.03778],[40.97889,29.04861],[40.97917,29.0625],[40.97163,29.07637],[40.96056,29.08444],[40.95417,29.09417],[40.94611,29.10694],[40.93787,29.11415],[40.92681,29.1242],[40.92056,29.13361],[40.91042,29.15574],[40.8984,29.16959],[40.8904,29.1774],[40.88858,29.19118],[40.88456,29.21042],[40.88028,29.23167],[40.87138,29.25594],[40.86111,29.27323],[40.85685,29.28351],[40.85222,29.2932],[40.84566,29.30005],[40.83004,29.32225],[40.81057,29.34741],[40.80767,29.3639],[40.79909,29.38022],[40.79145,29.39186],[40.78361,29.41139]],"dA":[358,373,388,403,418,433,448,463,478,493,508,523,538,553,568,583,598,613,628,643,658,673,688,703,718,733,748,763,778,793,808,823,838,853,868,883,898,913,928,943,958,973,988,1003,1018,1033,1048,1063,1078,1093,1108,1123,1138,1153,1168,1183,1198,1213,1228,1243,1258,1273,1288,1303,1318,1333,1348,1363,1378,1393,1408],"dB":[365,380,395,410,425,440,455,470,485,500,515,530,545,560,575,590,605,620,635,650,665,680,695,710,725,740,755,770,785,800,815,830,845,860,875,890,905,920,935,950,965,980,995,1010,1025,1040,1055,1070,1085,1100,1115,1130,1145,1160,1175,1190,1205,1220,1235,1250,1265,1280,1295,1310,1325,1340,1355,1370,1385,1400],"src":"tcdd"},"Metrobüs":{"n":["Beylikdüzü Son Durak","Beykent","Cumhuriyet Mahallesi","Beylikdüzü Belediye","Beylikdüzü","Güzelyurt","Haramidere","Haramidere Sanayi","Saadetdere Mahallesi","Mustafa Kemal Paşa","Cihangir Üniv. Mah.","Avcılar (İÜ Kampüsü)","Şükrübey","İBB Sosyal Tesisler","Küçükçekmece","Cennet Mahallesi","Florya","Beşyol","Sefaköy","Yenibosna","Şirinevler","Bahçelievler","İncirli","Zeytinburnu","Merter","Cevizlibağ","Topkapı","Bayrampaşa – Maltepe","Adnan Menderes Blv.","Edirnekapı","Ayvansaray","Halıcıoğlu","Okmeydanı","Darülaceze – Perpa","Okmeydanı Hastane","Çağlayan","Mecidiyeköy","Zincirlikuyu","Boğaziçi Köprüsü","Burhaniye","Altunizade","Acıbadem","Uzunçayır","Fikirtepe","Söğütlüçeşme"],"km":[0.0,0.0,1.01,1.82,2.56,3.37,4.07,5.17,6.05,7.36,8.31,9.27,10.22,11.95,13.68,14.84,15.39,16.46,17.05,20.35,21.36,23.0,23.84,25.08,26.32,27.88,28.53,29.19,29.84,30.49,31.69,32.89,34.5,35.4,36.3,36.74,37.64,39.6,42.11,44.62,45.86,46.9,48.78,49.85,50.72],"t":[0,0,2,4,5,7,8,10,12,15,17,18,20,24,27,30,31,33,34,41,43,46,47,50,52,56,57,58,59,61,63,65,69,70,72,73,75,79,84,89,91,93,97,99,101],"h":2,"f":"06:00","l":"23:59","k":"metrobus","c":"#c62828","fare":[[1,33.08,14.58,20.47],[2,39.57,15.87,24.46],[3,46.2,18.48,28.35],[9,52.81,21.09,33.08],[15,58.0,22.55,33.54],[21,60.69,22.55,35.66],[27,62.67,22.55,35.66],[33,64.03,22.55,37.61],[43,68.59,22.55,37.61]],"p":[[41.01928,28.63124],[41.01928,28.63124],[41.01541,28.64143],[41.01234,28.64951],[41.00953,28.65698],[41.00656,28.6652],[41.00595,28.67301],[41.00426,28.68521],[40.99971,28.69306],[40.99493,28.7063],[40.98999,28.71479],[40.98504,28.72329],[40.9801,28.73178],[40.98325,28.75077],[40.98639,28.76975],[40.98534,28.78273],[40.9867,28.78857],[40.99442,28.79494],[40.99865,28.7986],[40.99235,28.83473],[40.99173,28.84601],[40.99519,28.86394],[40.99789,28.87267],[41.00276,28.88502],[41.00764,28.89737],[41.01626,28.91066],[41.02052,28.91534],[41.02477,28.92002],[41.02902,28.92469],[41.03328,28.92937],[41.04114,28.93797],[41.04901,28.94657],[41.0567,28.96149],[41.06206,28.96875],[41.06742,28.97601],[41.06734,28.98087],[41.06692,28.99104],[41.0661,29.013],[41.04908,29.02998],[41.03207,29.04695],[41.02159,29.04853],[41.01511,29.05643],[40.99909,29.05675],[40.99366,29.0471],[40.99143,29.03787]]}},"X":[["M1A",0,"M1B",0,2],["M1A",0,"M2",0,2],["M1A",0,"Marmaray",12,2],["M1A",1,"M1B",1,2],["M1A",2,"M1B",2,2],["M1A",3,"M1B",3,2],["M1A",4,"M1B",4,2],["M1A",5,"M1B",5,2],["M1A",6,"M1B",6,2],["M1A",7,"M1B",7,2],["M1A",10,"Metrobüs",24,2],["M1A",12,"M3",2,2],["M1A",12,"Metrobüs",22,3],["M1A",13,"Metrobüs",21,2],["M1A",14,"Metrobüs",20,2],["M1A",15,"M9",1,2],["M1A",15,"Metrobüs",19,5],["M1B",0,"M2",0,2],["M1B",0,"Marmaray",12,2],["M1B",12,"M3",7,2],["M2",0,"Marmaray",12,2],["M2",6,"M7",2,3],["M2",6,"Metrobüs",36,4],["M2",7,"M11",0,3],["M2",7,"Metrobüs",37,5],["M2",8,"M6",0,2],["M3",1,"Marmaray",8,3],["M3",2,"Metrobüs",22,3],["M3",9,"M7",16,2],["M3",11,"M9",11,2],["M3",19,"M11",11,4],["M4",1,"Marmaray",15,2],["M4",6,"M8",3,2],["M5",0,"Marmaray",14,2],["M5",3,"Metrobüs",40,4],["M5",13,"M8",10,2],["M7",2,"Metrobüs",36,4],["M7",4,"M11",1,4],["M9",0,"Marmaray",7,2],["M9",13,"M11",12,2],["M11",0,"Metrobüs",37,2],["M11",14,"Marmaray",0,3],["Marmaray",2,"Metrobüs",14,5],["Marmaray",16,"Metrobüs",44,2]],"P":[{"n":"Arnavutköy Hastane","m":[["M11",9]]},{"n":"Zincirlikuyu","m":[["M2",7],["M11",0],["Metrobüs",37]]},{"n":"Göktürk","m":[["M11",4]]},{"n":"Halkalı","m":[["M11",14],["Marmaray",0]]},{"n":"Halkalı Stadı","m":[["M11",13]]},{"n":"Hasdal","m":[["M11",2]]},{"n":"Kâğıthane","m":[["M7",4],["M11",1]]},{"n":"Kargo Terminali","m":[["M11",7]]},{"n":"Kayaşehir Merkez","m":[["M3",19],["M11",11]]},{"n":"Kemerburgaz","m":[["M11",3]]},{"n":"Olimpiyatköy","m":[["M9",13],["M11",12]]},{"n":"Taşoluk","m":[["M11",8]]},{"n":"İbn Haldun Üniversitesi","m":[["M11",10]]},{"n":"İhsaniye","m":[["M11",5]]},{"n":"İstanbul Havalimanı","m":[["M11",6]]},{"n":"Aksaray","m":[["M1A",1],["M1B",1]]},{"n":"Atatürk Havalimanı","m":[["M1A",17]]},{"n":"Bahçelievler","m":[["M1A",13],["Metrobüs",21]]},{"n":"Bakırköy – İncirli","m":[["M1A",12],["M3",2],["Metrobüs",22]]},{"n":"Bayrampaşa – Maltepe","m":[["M1A",4],["M1B",4]]},{"n":"Davutpaşa – YTÜ","m":[["M1A",9]]},{"n":"DTM – Fuar Merkezi","m":[["M1A",16]]},{"n":"Emniyet – Fatih","m":[["M1A",2],["M1B",2]]},{"n":"Kocatepe","m":[["M1A",6],["M1B",6]]},{"n":"Merter","m":[["M1A",10],["Metrobüs",24]]},{"n":"Otogar","m":[["M1A",7],["M1B",7]]},{"n":"Sağmalcılar","m":[["M1A",5],["M1B",5]]},{"n":"Terazidere","m":[["M1A",8]]},{"n":"Topkapı – Ulubatlı","m":[["M1A",3],["M1B",3]]},{"n":"Yenibosna","m":[["M1A",15],["M9",1],["Metrobüs",19]]},{"n":"Yenikapı","m":[["M1A",0],["M1B",0],["M2",0],["Marmaray",12]]},{"n":"Zeytinburnu","m":[["M1A",11]]},{"n":"Ataköy – Şirinevler","m":[["M1A",14],["Metrobüs",20]]},{"n":"Bağcılar Meydan","m":[["M1B",11]]},{"n":"Esenler","m":[["M1B",8]]},{"n":"Kirazlı","m":[["M1B",12],["M3",7]]},{"n":"Menderes","m":[["M1B",9]]},{"n":"Üçyüzlü","m":[["M1B",10]]},{"n":"4. Levent","m":[["M2",9]]},{"n":"Atatürk Oto Sanayi","m":[["M2",13]]},{"n":"Darüşşafaka","m":[["M2",14]]},{"n":"Hacıosman","m":[["M2",15]]},{"n":"Haliç","m":[["M2",2]]},{"n":"İTÜ – Ayazağa","m":[["M2",12]]},{"n":"Levent","m":[["M2",8],["M6",0]]},{"n":"Osmanbey","m":[["M2",5]]},{"n":"Sanayi Mahallesi","m":[["M2",10]]},{"n":"Seyrantepe","m":[["M2",11]]},{"n":"Şişhane","m":[["M2",3]]},{"n":"Mecidiyeköy","m":[["M2",6],["M7",2],["Metrobüs",36]]},{"n":"Taksim","m":[["M2",4]]},{"n":"Vezneciler","m":[["M2",1]]},{"n":"Bakırköy Sahil","m":[["M3",0]]},{"n":"Başak Konutları","m":[["M3",14]]},{"n":"Haznedar","m":[["M3",3]]},{"n":"İkitelli Sanayi","m":[["M3",11],["M9",11]]},{"n":"İlkyuva","m":[["M3",4]]},{"n":"İSTOÇ","m":[["M3",10]]},{"n":"Mahmutbey","m":[["M3",9],["M7",16]]},{"n":"Başakşehir-Metrokent","m":[["M3",15]]},{"n":"Molla Gürani","m":[["M3",6]]},{"n":"Onurkent","m":[["M3",16]]},{"n":"Özgürlük Meydanı","m":[["M3",1],["Marmaray",8]]},{"n":"Şehir Hastanesi","m":[["M3",17]]},{"n":"Siteler","m":[["M3",13]]},{"n":"Toplu Konutlar","m":[["M3",18]]},{"n":"Turgut Özal","m":[["M3",12]]},{"n":"Yenimahalle","m":[["M3",8]]},{"n":"Yıldıztepe","m":[["M3",5]]},{"n":"Acıbadem","m":[["M4",2]]},{"n":"Ayrılık Çeşmesi","m":[["M4",1],["Marmaray",15]]},{"n":"Bostancı","m":[["M4",7]]},{"n":"Esenkent[2]","m":[["M4",12]]},{"n":"Fevzi Çakmak-Hastane","m":[["M4",19]]},{"n":"Göztepe","m":[["M4",4]]},{"n":"Gülsuyu","m":[["M4",11]]},{"n":"Hastane – Adliye","m":[["M4",13]]},{"n":"Huzurevi","m":[["M4",10]]},{"n":"Kadıköy","m":[["M4",0]]},{"n":"Kartal","m":[["M4",15]]},{"n":"Pegasus-Kozyatağı","m":[["M4",6],["M8",3]]},{"n":"Küçükyalı","m":[["M4",8]]},{"n":"Kurtköy","m":[["M4",21]]},{"n":"Maltepe","m":[["M4",9]]},{"n":"Pendik","m":[["M4",17]]},{"n":"Sabiha Gökçen Havalimanı","m":[["M4",22]]},{"n":"Soğanlık","m":[["M4",14]]},{"n":"Tavşantepe","m":[["M4",18]]},{"n":"Ünalan","m":[["M4",3]]},{"n":"Yakacık-Adnan Kahveci","m":[["M4",16]]},{"n":"Yayalar – Şeyhli","m":[["M4",20]]},{"n":"Yenisahra","m":[["M4",5]]},{"n":"Altınşehir","m":[["M5",11]]},{"n":"Altunizade","m":[["M5",3],["Metrobüs",40]]},{"n":"Bağlarbaşı","m":[["M5",2]]},{"n":"Bulgurlu","m":[["M5",5]]},{"n":"Çakmak","m":[["M5",9]]},{"n":"Çarşı","m":[["M5",7]]},{"n":"Çekmeköy","m":[["M5",15]]},{"n":"Dudullu","m":[["M5",13],["M8",10]]},{"n":"Fıstıkağacı","m":[["M5",1]]},{"n":"Hasanpaşa","m":[["M5",22]]},{"n":"Ihlamurkuyu","m":[["M5",10]]},{"n":"İmam Hatip Lisesi","m":[["M5",12]]},{"n":"Kısıklı","m":[["M5",4]]},{"n":"Meclis","m":[["M5",16]]},{"n":"Necip Fazıl","m":[["M5",14]]},{"n":"Samandıra Merkez","m":[["M5",20]]},{"n":"Sancaktepe","m":[["M5",19]]},{"n":"Sancaktepe Şehir Hastanesi","m":[["M5",18]]},{"n":"Sarıgazi","m":[["M5",17]]},{"n":"Sultanbeyli","m":[["M5",23]]},{"n":"Ümraniye","m":[["M5",6]]},{"n":"Üsküdar","m":[["M5",0],["Marmaray",14]]},{"n":"Veysel Karani","m":[["M5",21]]},{"n":"Yamanevler","m":[["M5",8]]},{"n":"Etiler","m":[["M6",2]]},{"n":"Hisarustu-Bogazici Universitesi","m":[["M6",3]]},{"n":"Nispetiye","m":[["M6",1]]},{"n":"Alibeyköy","m":[["M7",6]]},{"n":"Çağlayan","m":[["M7",3]]},{"n":"Çırçır","m":[["M7",7]]},{"n":"Fulya","m":[["M7",1]]},{"n":"Göztepe Mahallesi","m":[["M7",15]]},{"n":"Karadeniz Mahallesi","m":[["M7",12]]},{"n":"Kâzım Karabekir","m":[["M7",10]]},{"n":"Nurtepe","m":[["M7",5]]},{"n":"Oruç Reis","m":[["M7",14]]},{"n":"Giyimkent – Tekstilkent","m":[["M7",13]]},{"n":"Veysel Karani – Akşemsettin","m":[["M7",8]]},{"n":"Yenimahalle","m":[["M7",11]]},{"n":"Yeşilpınar","m":[["M7",9]]},{"n":"Yıldız","m":[["M7",0]]},{"n":"Ayşekadın","m":[["M8",2]]},{"n":"Bostancı","m":[["M8",0]]},{"n":"Emin Ali Paşa","m":[["M8",1]]},{"n":"Huzur","m":[["M8",11]]},{"n":"İçerenköy","m":[["M8",5]]},{"n":"İmes","m":[["M8",8]]},{"n":"Kayışdağı","m":[["M8",6]]},{"n":"Küçükbakkalköy","m":[["M8",4]]},{"n":"Mevlana","m":[["M8",7]]},{"n":"Modoko-Keyap","m":[["M8",9]]},{"n":"Parseller","m":[["M8",12]]},{"n":"15 Temmuz","m":[["M9",6]]},{"n":"29 Ekim – Cumhuriyet","m":[["M9",3]]},{"n":"Ataköy","m":[["M9",0],["Marmaray",7]]},{"n":"Atatürk Mahallesi","m":[["M9",8]]},{"n":"Bahariye","m":[["M9",9]]},{"n":"Çobançeşme","m":[["M9",2]]},{"n":"Doğu Sanayi","m":[["M9",4]]},{"n":"Halkalı Caddesi","m":[["M9",7]]},{"n":"Masko","m":[["M9",10]]},{"n":"Mimar Sinan","m":[["M9",5]]},{"n":"Ziya Gökalp Mahallesi","m":[["M9",12]]},{"n":"Atalar","m":[["Marmaray",27]]},{"n":"Aydıntepe","m":[["Marmaray",35]]},{"n":"Başak","m":[["Marmaray",28]]},{"n":"Bostancı","m":[["Marmaray",21]]},{"n":"Cevizli","m":[["Marmaray",26]]},{"n":"Darıca","m":[["Marmaray",41]]},{"n":"Erenköy","m":[["Marmaray",19]]},{"n":"Feneryolu","m":[["Marmaray",17]]},{"n":"Florya","m":[["Marmaray",3]]},{"n":"Florya Akvaryum","m":[["Marmaray",4]]},{"n":"GTÜ-Fatih","m":[["Marmaray",39]]},{"n":"Gebze","m":[["Marmaray",42]]},{"n":"Göztepe","m":[["Marmaray",18]]},{"n":"Güzelyalı","m":[["Marmaray",34]]},{"n":"Kartal","m":[["Marmaray",29]]},{"n":"Kaynarca","m":[["Marmaray",32]]},{"n":"Kazlıçeşme","m":[["Marmaray",11]]},{"n":"Küçükyalı","m":[["Marmaray",22]]},{"n":"Küçükçekmece","m":[["Marmaray",2],["Metrobüs",14]]},{"n":"Maltepe","m":[["Marmaray",25]]},{"n":"Mustafa Kemal","m":[["Marmaray",1]]},{"n":"Osmangazi","m":[["Marmaray",40]]},{"n":"Pendik","m":[["Marmaray",31]]},{"n":"Sirkeci","m":[["Marmaray",13]]},{"n":"Suadiye","m":[["Marmaray",20]]},{"n":"Söğütlüçeşme","m":[["Marmaray",16],["Metrobüs",44]]},{"n":"Süreyya Plajı","m":[["Marmaray",24]]},{"n":"Tersane","m":[["Marmaray",33]]},{"n":"Tuzla","m":[["Marmaray",37]]},{"n":"Yenimahalle","m":[["Marmaray",9]]},{"n":"Yeşilköy","m":[["Marmaray",5]]},{"n":"Yeşilyurt","m":[["Marmaray",6]]},{"n":"Yunus","m":[["Marmaray",30]]},{"n":"Zeytinburnu-Fişekhane","m":[["Marmaray",10]]},{"n":"Çayırova","m":[["Marmaray",38]]},{"n":"İdealtepe","m":[["Marmaray",23]]},{"n":"İçmeler","m":[["Marmaray",36]]},{"n":"Acıbadem","m":[["Metrobüs",41]]},{"n":"Adnan Menderes Blv.","m":[["Metrobüs",28]]},{"n":"Avcılar (İÜ Kampüsü)","m":[["Metrobüs",11]]},{"n":"Ayvansaray","m":[["Metrobüs",30]]},{"n":"Bayrampaşa – Maltepe","m":[["Metrobüs",27]]},{"n":"Beykent","m":[["Metrobüs",1]]},{"n":"Beylikdüzü","m":[["Metrobüs",4]]},{"n":"Beylikdüzü Belediye","m":[["Metrobüs",3]]},{"n":"Beylikdüzü Son Durak","m":[["Metrobüs",0]]},{"n":"Beşyol","m":[["Metrobüs",17]]},{"n":"Boğaziçi Köprüsü","m":[["Metrobüs",38]]},{"n":"Burhaniye","m":[["Metrobüs",39]]},{"n":"Cennet Mahallesi","m":[["Metrobüs",15]]},{"n":"Cevizlibağ","m":[["Metrobüs",25]]},{"n":"Cihangir Üniv. Mah.","m":[["Metrobüs",10]]},{"n":"Cumhuriyet Mahallesi","m":[["Metrobüs",2]]},{"n":"Darülaceze – Perpa","m":[["Metrobüs",33]]},{"n":"Edirnekapı","m":[["Metrobüs",29]]},{"n":"Fikirtepe","m":[["Metrobüs",43]]},{"n":"Florya","m":[["Metrobüs",16]]},{"n":"Güzelyurt","m":[["Metrobüs",5]]},{"n":"Halıcıoğlu","m":[["Metrobüs",31]]},{"n":"Haramidere","m":[["Metrobüs",6]]},{"n":"Haramidere Sanayi","m":[["Metrobüs",7]]},{"n":"Mustafa Kemal Paşa","m":[["Metrobüs",9]]},{"n":"Okmeydanı","m":[["Metrobüs",32]]},{"n":"Okmeydanı Hastane","m":[["Metrobüs",34]]},{"n":"Saadetdere Mahallesi","m":[["Metrobüs",8]]},{"n":"Sefaköy","m":[["Metrobüs",18]]},{"n":"Topkapı","m":[["Metrobüs",26]]},{"n":"Uzunçayır","m":[["Metrobüs",42]]},{"n":"Zeytinburnu","m":[["Metrobüs",23]]},{"n":"Çağlayan","m":[["Metrobüs",35]]},{"n":"İBB Sosyal Tesisler","m":[["Metrobüs",13]]},{"n":"Şükrübey","m":[["Metrobüs",12]]}]};

// İstanbulkart binis ücretleri (20.07.2026): ilk binis, 1. aktarma, 2. aktarma+
// Sabit ücretli hatlar (metro) icin. Kaynak: İBB tarifesi x1,10 zam.
const FLAT = [
  { tam: 46.20, ogr: 22.55, sos: 25.06 },
  { tam: 34.40, ogr: 16.94, sos: 18.85 },
  { tam: 26.42, ogr: 13.02, sos: 14.48 },
];

const CSS = `<style>
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

  .j-meta em.x{color:var(--line); font-weight:700}
  .legs{display:none; flex-direction:column; gap:0; padding:0 22px 4px}
  .legs.on{display:flex}
  .leg{display:flex; align-items:baseline; gap:10px; padding:11px 0; border-top:1px dashed var(--edge); font-size:13.5px}
  .leg:first-child{border-top:none}
  .leg .lg-code{flex:none; font-family:"Martian Mono",ui-monospace,monospace; font-size:11px; font-weight:700;
    letter-spacing:.5px; color:#fff; background:var(--line); border-radius:6px; padding:3px 7px}
  .leg.xfer .lg-code{background:var(--paper-2); color:var(--faint); border:1.5px solid var(--edge)}
  .leg .lg-od{flex:1 1 auto; min-width:0; font-weight:600; color:var(--ink)}
  .leg .lg-meta{flex:none; color:var(--faint); font-variant-numeric:tabular-nums}
  .leg.xfer .lg-od{font-weight:500; color:var(--faint)}

  .linenav{margin-top:14px}
  .linenav a{display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600;
    color:var(--line); text-decoration:none; padding:8px 14px; border:1.5px solid var(--edge);
    border-radius:999px; background:var(--paper-2); transition:background .15s, border-color .15s;}
  .linenav a:hover{background:var(--line-soft); border-color:var(--line)}
  .linenav i{font-style:normal}

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
    .field.to{order:3}
    /* Alanlar alt alta gelince buton kutusu DÖNDÜRÜLMEZ: döndürülen eleman
       layout'ta eski yerini koruduğu için tam genişlikte bir bar 90° dönünce
       komşu select'lerin üstüne taşıyordu. Yerine ortalanmış kompakt daire —
       ikondaki yukarı/aşağı oklar zaten dikey dizilime uyuyor. */
    .swap{order:2; justify-self:center; align-self:center;
      width:44px; height:44px; border-radius:50%; transform:none}
  }
  @media (prefers-reduced-motion:reduce){
    *{animation:none !important; transition:none !important}
  }
</style>`;

// --- Sayfa üretici: tek hat -------------------------------------------------
function buildPage(L) {
const S = L.stations, FARE = L.fares, FREE = L.free;
const LAST = S.length - 1;
const other = LINES[OTHER[L.id]];
function fareFor(n) { for (const f of FARE) if (n <= f.maxN) return f; return FARE[FARE.length - 1]; }
function tripTime(i, j) { return j > i ? (S[j].tH - S[i].tH) : (S[j].tG - S[i].tG); }

// --- Sık aranan güzergâhlar (SEO) ------------------------------------------
const POPULAR = L.popular.map(([a, b]) => ({ a, b, ...planRoute(a, b) }));

// --- SSS (hem görünür HTML hem JSON-LD için tek kaynak) --------------------
const FAQ = L.faq;

// --- HTML parçaları (sunucu tarafında üretilir) ----------------------------
// Ağ genelinde seçenekler: M11 · aktarma · Marmaray şeklinde gruplanır.
// Halkalı yalnızca "Aktarma noktası" grubunda görünür (iki hatta da ait).
const opts = (selId) => {
  const grp = (label, line, skipHub) =>
    "<optgroup label=\"" + label + "\">" +
    LINES[line].stations.map((s, i) => (skipHub && i === HUB[line]) ? "" :
      "<option value=\"" + NODE_ID(line, i) + "\"" + (NODE_ID(line, i) === selId ? " selected" : "") + ">" + s.name + "</option>"
    ).join("") + "</optgroup>";
  return grp("M11 · Gayrettepe – Halkalı", "m11", true) +
    "<optgroup label=\"Aktarma noktası\"><option value=\"" + HUB_ID + "\"" +
      (HUB_ID === selId ? " selected" : "") + ">Halkalı · M11 ↔ Marmaray</option></optgroup>" +
    grp("Marmaray · Halkalı – Gebze", "b1", true);
};

const popularHTML = POPULAR.map(p =>
  "<button class=\"jump\" type=\"button\" data-from=\"" + p.a + "\" data-to=\"" + p.b + "\">" +
  "<span class=\"j-od\">" + p.from + "<i>→</i>" + p.to + "</span>" +
  "<span class=\"j-meta\"><b>" + p.time + " dk</b><em>" + p.stops + " durak</em><em>" + lira(p.fare) + "</em>" +
    (p.xfer ? "<em class=\"x\">aktarmalı</em>" : "") + "</span>" +
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
  return "<tr><td>" + lo + "–" + f.maxN + " durak</td><td>" + lira(f.tam) + "</td><td>" + lira(f.ogr) + "</td><td>" + lira(f.sos) + "</td></tr>";
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
  "name": L.appName,
  "url": SITE + L.path,
  "applicationCategory": "TravelApplication",
  "operatingSystem": "Web",
  "inLanguage": "tr-TR",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "TRY" }
};

return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${L.title}</title>
<meta name="description" content="${L.desc}">
<link rel="canonical" href="${SITE}${L.path}">
<meta property="og:type" content="website">
<meta property="og:title" content="${L.ogTitle}">
<meta property="og:description" content="${L.ogDesc}">
<meta property="og:locale" content="tr_TR">
<meta property="og:url" content="${SITE}${L.path}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#12100F">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&family=Martian+Mono:wght@600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(appJsonLd)}</script>
${CSS}
</head>
<body>
<main class="wrap">
  <div class="topline"></div>
  <header>
    <div class="kicker">
      <span class="roundel">${L.code}</span>
      <span class="kt">${L.kicker}</span>
    </div>
    <h1>İki durak arası <em>kaç dakika,</em> kaç lira?</h1>
    <p class="lede">${L.lede}</p>
    <div class="facts">${L.facts}</div>
    <nav class="linenav"><a href="${other.path}">${other.code === "B1" ? "Marmaray hesaplayıcı" : "M11 hesaplayıcı"} <i>→</i></a></nav>
  </header>

  <div class="card">
    <div class="picker">
      <div class="field from">
        <label for="from"><b>A</b> Nereden</label>
        <div class="selwrap"><select id="from">${opts(NODE_ID(L.id, 0))}</select></div>
      </div>
      <button id="swap" class="swap" type="button" aria-label="Yönü değiştir" title="Yönü değiştir">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/></svg>
      </button>
      <div class="field to">
        <label for="to"><b>B</b> Nereye</label>
        <div class="selwrap"><select id="to">${opts(NODE_ID(L.id, LAST))}</select></div>
      </div>
    </div>
    <div class="board">
      <div class="route" id="route">${S[0].name} <span class="arr">→</span> ${S[LAST].name}</div>
      <div class="time"><b id="time">${tripTime(0, LAST)}</b><span class="unit">dakika</span></div>
      <div class="dir" id="dir">${L.dirTo}</div>
    </div>
    <div class="stats">
      <div class="stat"><span class="k">Mesafe</span><span class="v"><b id="dist">${S[LAST].km.toFixed(1).replace(".", ",")}</b> km</span></div>
      <div class="stat"><span class="k">Durak</span><span class="v"><b id="stops">${LAST}</b></span></div>
      <div class="stat fare"><span class="k">Ücret · tam</span><span class="v"><b id="fare">${lira(fareFor(LAST).tam)}</b></span><span class="sub" id="faresub"></span></div>
    </div>
    <div class="legs" id="legs"></div>
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
  <p class="sub">Tek dokunuşla en çok aranan yolculukları hesapla — aktarmalı rotalar dahil.</p>
  <div class="routes">${popularHTML}</div>

  <h2>Durak listesi & ilk / son tren</h2>
  <p class="sub">${S.length} istasyon, aktarma noktaları ve her iki yön için ilk–son sefer saatleri.</p>
  <div class="tablewrap">
    <table>
      <thead><tr><th>İstasyon</th><th>İlçe</th><th>Aktarma</th><th>${L.dirTo}<br>(ilk–son)</th><th>${L.dirFrom}<br>(ilk–son)</th></tr></thead>
      <tbody>${stationRows}</tbody>
    </table>
  </div>

  <h2>Ücret tarifesi · 20 Temmuz 2026</h2>
  <p class="sub">Gidilen durak sayısına göre resmî İBB/UKOME kademeleri.</p>
  <div class="tablewrap">
    <table>
      <thead><tr><th>Mesafe</th><th>Tam</th><th>Öğrenci</th><th>İndirimli (sosyal)</th></tr></thead>
      <tbody>${fareRows}</tbody>
    </table>
  </div>
  <p class="fine">Kademeler <b>gidilen durak</b> sayısına göredir (iki komşu istasyon arası = 1 durak); uçtan uca yolculuk ${LAST} duraktır. Girişte en yüksek ücret alınır, çıkışta gidilmeyen mesafe karta iade edilir. Gece 00:30–05:30 seferlerinde çift ücret uygulanır.</p>

  <h2>Sıkça sorulan sorular</h2>
  <p class="sub">${L.code === "B1" ? "Marmaray" : L.code} hakkında en çok merak edilenler.</p>
  ${faqHTML}

  <p class="foot">
    <b>Gayriresmî araçtır.</b> Süreler TCDD son tren tarifesine dayanır ve gündüz seferleriyle 1–2 dk oynayabilir. Ücretler İBB/UKOME 20.07.2026 tarifesindendir; değişebilir. Yolculuk öncesi
    <a href="https://www.tcddtasimacilik.gov.tr" rel="noopener">tcddtasimacilik.gov.tr</a> ve
    <a href="https://tuhim.ibb.gov.tr" rel="noopener">İBB ücret tarifesi</a> sayfalarını kontrol edin.
  </p>
</main>

<script>
(function(){
  var NET = ${JSON.stringify(Object.fromEntries(Object.entries(LINES).map(([k, l]) => [k, {
    code: l.code === "B1" ? "Marmaray" : l.code,
    dir: [l.dirTo, l.dirFrom],
    head: HEADWAY[k],
    hub: HUB[k],
    free: l.free,
    fares: l.fares,
    st: l.stations.map(s => ({ n: s.name, km: s.km, tH: s.tH, tG: s.tG })),
  }])))};
  var LINE = ${JSON.stringify(L.id)};
  var WALK = ${TRANSFER_WALK};
  var CAMP_END = new Date(2026, 6, 31, 23, 59, 59);
  var lira = function(v){ return "₺" + v.toFixed(2).replace(".", ","); };
  function fareFor(l, n){ var F = NET[l].fares; for(var k=0;k<F.length;k++){ if(n<=F[k].maxN) return F[k]; } return F[F.length-1]; }
  function parseId(v){ var p = String(v).split(":"); return { l: p[0], i: +p[1] }; }
  // Aktarma noktası her iki hatta da var; istenen hatta karşılığını verir.
  function onLine(node, line){ return node.l === line ? node.i : (node.l !== line && isHub(node) ? NET[line].hub : -1); }
  function isHub(node){ return node.i === NET[node.l].hub; }
  function legTime(l, i, j){ var S = NET[l].st; return j > i ? (S[j].tH - S[i].tH) : (S[j].tG - S[i].tG); }

  // Rota: iki hat yalnızca Halkalı'da kesiştiği için en fazla bir aktarma var.
  function route(a, b){
    if(a.l === b.l) return [{ l: a.l, i: a.i, j: b.i }];
    var ai = onLine(a, a.l), bj = onLine(b, b.l);
    var legs = [{ l: a.l, i: ai, j: NET[a.l].hub }, { l: b.l, i: NET[b.l].hub, j: bj }];
    return legs.filter(function(g){ return g.i !== g.j; });
  }
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
    // Şerit yalnızca bu sayfanın hattını gösterir; uçlardan biri başka hattaysa
    // o uç Halkalı'ya (aktarma noktasına) düşürülerek boyanır.
    var A = parseId(fromEl.value), B = parseId(toEl.value);
    var i = A.l === LINE ? A.i : NET[LINE].hub, j = B.l === LINE ? B.i : NET[LINE].hub;
    var lo = Math.min(i,j), hi = Math.max(i,j);
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
      fromEl.value = LINE + ":" + k; awaitingTo = true;
      setHint("Kalkış: <b>" + NET[LINE].st[k].n + "</b> — şimdi <b>varış</b> istasyonuna dokun.");
    } else {
      toEl.value = LINE + ":" + k; awaitingTo = false;
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
    var A = parseId(fromEl.value), B = parseId(toEl.value);
    var a = NET[A.l].st[A.i], b = NET[B.l].st[B.i];
    var fare = $("fare"), sub = $("faresub"), note = $("note"), legsEl = $("legs");
    $("route").innerHTML = a.n + ' <span class="arr">→</span> ' + b.n;
    paintRail();

    var same = (A.l === B.l && A.i === B.i) || (isHub(A) && isHub(B));
    if(same){
      setTime("0"); $("dist").textContent = "0,0"; $("stops").textContent = "0";
      $("dir").textContent = "—"; fare.textContent = "—"; sub.textContent = "";
      legsEl.className = "legs"; legsEl.innerHTML = "";
      note.textContent = "Kalkış ve varış aynı istasyon. Farklı bir durak seçin.";
      return;
    }

    var legs = route(A, B), campaign = new Date() <= CAMP_END;
    var time = 0, stops = 0, dist = 0, cost = 0, ogr = 0, sos = 0, freeLeg = false, rows = [];
    for(var k = 0; k < legs.length; k++){
      var g = legs[k], N = NET[g.l], S = N.st;
      var t = legTime(g.l, g.i, g.j), n = Math.abs(g.i - g.j);
      var d = Math.abs(S[g.i].km - S[g.j].km);
      time += t; stops += n; dist += d;
      var free = campaign && N.free.indexOf(g.i) !== -1;
      var f = fareFor(g.l, n);
      if(free) freeLeg = true; else { cost += f.tam; ogr += f.ogr; sos += f.sos; }
      if(k > 0){                                   // aktarma satırı
        var wait = Math.round(N.head / 2);
        time += WALK + wait;
        rows.push('<div class="leg xfer"><span class="lg-code">⇄</span>' +
          '<span class="lg-od">Halkalı aktarması · ' + NET[legs[k-1].l].code + ' → ' + N.code + '</span>' +
          '<span class="lg-meta">~' + WALK + ' dk yürüme + ort. ' + wait + ' dk bekleme</span></div>');
      }
      rows.push('<div class="leg"><span class="lg-code">' + N.code + '</span>' +
        '<span class="lg-od">' + S[g.i].n + ' → ' + S[g.j].n + '</span>' +
        '<span class="lg-meta">' + t + ' dk · ' + n + ' durak · ' + (free ? "ücretsiz" : lira(f.tam)) + '</span></div>');
    }

    setTime(String(time));
    $("dist").textContent = dist.toFixed(1).replace(".", ",");
    $("stops").textContent = stops;
    $("dir").textContent = legs.length > 1 ? "Halkalı aktarmalı"
      : (legs[0].j > legs[0].i ? NET[legs[0].l].dir[0] : NET[legs[0].l].dir[1]);

    if(cost === 0 && freeLeg){ fare.textContent = "Ücretsiz"; sub.textContent = "31 Tem 2026'ya kadar biniş bedava"; }
    else {
      fare.textContent = lira(cost);
      sub.textContent = "Öğr. " + lira(ogr) + " · Sosyal " + lira(sos) + (freeLeg ? " · bir bacak ücretsiz" : "");
    }

    legsEl.innerHTML = legs.length > 1 ? rows.join("") : "";
    legsEl.className = legs.length > 1 ? "legs on" : "legs";

    note.textContent = legs.length > 1
      ? "Marmaray aktarma indirimi vermez: iki hattın ücreti ayrı ayrı ödenir. Aktarma payı sefer aralığından tahmindir (bekleme 0–" + NET[legs[1].l].head + " dk arasında değişir)."
      : "Süre, TCDD son tren tarifesinden. Saatler dakikaya yuvarlıdır; iki yön ±1 dk farklı olabilir.";
  }

  fromEl.addEventListener("change", function(){ awaitingTo = false; calc(); });
  toEl.addEventListener("change", function(){ awaitingTo = false; calc(); });
  $("swap").addEventListener("click", function(){ var t = fromEl.value; fromEl.value = toEl.value; toEl.value = t; awaitingTo = false; calc(); });
  $("railreset").addEventListener("click", function(){
    fromEl.value = LINE + ":0"; toEl.value = LINE + ":" + (NET[LINE].st.length - 1); awaitingTo = false;
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
}

function buildPlanner() {
const P = NETWORK.P, LN = NETWORK.L;
// Seçenekler alfabetik (Türkçe sıralama); value = P dizisindeki asıl indeks.
const placeOpts = (sel) => P.map((p, i) => ({ p, i }))
  .sort((a, b) => a.p.n.localeCompare(b.p.n, "tr"))
  .map(({ p, i }) => {
    const lines = [...new Set(p.m.map(m => m[0]))];
    return "<option value=\"" + i + "\"" + (i === sel ? " selected" : "") + ">" +
      p.n + " · " + lines.join(", ") + "</option>";
  }).join("");
const iHav = P.findIndex(p => p.n === "İstanbul Havalimanı");
const iUsk = P.findIndex(p => p.n === "Üsküdar");

const FAQ = [
  { q: "İstanbul Havalimanı'ndan Üsküdar'a nasıl gidilir?",
    a: "M11 metrosuyla Halkalı'ya, oradan Marmaray'a aktarma yapılır. Planlayıcıya kalkış saatinizi girdiğinizde varış saatini, aktarma noktasını ve toplam ücreti dakika dakika gösterir." },
  { q: "Bu araç Google Maps'ten farkı ne?",
    a: "Yalnızca raylı sistem ve metrobüs gösterir; otobüs, dolmuş ve yürüyüş rotası yoktur. Buna karşılık her bacağın ücretini ayrı ayrı ve toplamı doğru hesaplar — mesafe bazlı hatlarda (M11, Marmaray, Metrobüs) kademeli tarife, metrolarda İstanbulkart aktarma indirimi uygulanır." },
  { q: "Süreler ne kadar güvenilir?",
    a: "M1A, M1B, M2, M3, M4, M5 ve M6 süreleri İBB Açık Veri GTFS tarifesinden, sefer sefer gerçek kalkış saatleriyle alınmıştır. M11 ve Marmaray TCDD'nin yayımladığı tarifeden türetilmiştir. Yalnızca M7, M8, M9 ve Metrobüs için istasyon bazlı tarife bulunamadığı için süre mesafeye orantılı dağıtılmıştır; bu bacaklar sonuçta 'tahmini' olarak işaretlenir." },
  { q: "Aktarma süresi nasıl hesaplanıyor?",
    a: "Aktarma = peronlar arası yürüme + bekleme. Bekleme, gerçek tarifesi olan hatlarda sıradaki kalkışa göre dakikasıyla hesaplanır — bu yüzden aynı güzergâhta 5 dakika erken çıkmak varış saatini hiç değiştirmeyebilir ya da 1 dakika geç kalmak 15 dakika kaybettirebilir. Tarifesi olmayan hatlarda ortalama (sefer aralığı ÷ 2) kullanılır. Yürüme süresi istasyon koordinatları arasındaki mesafeden hesaplanır (80 m/dk) ve yalnızca yatay mesafeyi kapsar; derin istasyonlarda gerçek geçiş daha uzun sürebilir." },
  { q: "Marmaray ve M11'de aktarma indirimi var mı?",
    a: "Yok. Marmaray aktarma vermeyen bir ana hat olarak işletilir; M11 de kendi mesafe tarifesini uygular. Bu hatlara veya bu hatlardan geçişte iki ücret ayrı ayrı ödenir. İndirim yalnızca sabit ücretli metro hatları arasındaki geçişlerde uygulanır." },
];
const faqHTML = FAQ.map(f => "<details><summary>" + f.q + "</summary><p>" + f.a + "</p></details>").join("");
const faqJsonLd = { "@context": "https://schema.org", "@type": "FAQPage",
  "mainEntity": FAQ.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })) };
const appJsonLd = { "@context": "https://schema.org", "@type": "WebApplication",
  "name": "İstanbul Metro & Marmaray Yolculuk Planlayıcı", "url": SITE + "/",
  "applicationCategory": "TravelApplication", "operatingSystem": "Web", "inLanguage": "tr-TR",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "TRY" } };

const lineChips = Object.keys(LN).map(k =>
  "<span class=\"lchip\" style=\"--lc:" + LN[k].c + "\">" + k + "</span>").join("");

return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>İstanbul Metro, Marmaray & Metrobüs Yolculuk Planlayıcı — Süre, Aktarma ve Ücret 2026</title>
<meta name="description" content="İki durak arası kaç dakika, kaç TL? Kalkış saatini gir, varış saatini ve aktarmaları dakika dakika gör. 13 hat, 265 istasyon: tüm metrolar, Marmaray ve Metrobüs. Güncel 2026 ücret tarifesi.">
<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:title" content="İstanbul Metro & Marmaray Yolculuk Planlayıcı — Süre, Aktarma, Ücret">
<meta property="og:description" content="Kalkış saatini gir, varış saatini ve aktarmaları gör. Metro, Marmaray ve Metrobüs — 265 istasyon, güncel 2026 ücretleri.">
<meta property="og:locale" content="tr_TR">
<meta property="og:url" content="${SITE}/">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#12100F">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&family=Martian+Mono:wght@600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(appJsonLd)}</script>
${CSS}
<style>
  .plan{display:grid; grid-template-columns:1fr 1fr auto; gap:10px; align-items:end; padding:22px 22px 18px}
  .plan .field.when{min-width:132px}
  .plan input[type=time]{width:100%; height:52px; padding:0 13px; font-size:16px; font-weight:600; font-family:inherit;
    color:var(--ink); background:var(--paper-2); border:1.5px solid var(--edge); border-radius:14px}
  .plan input[type=time]:focus{outline:none; border-color:var(--line); box-shadow:0 0 0 4px var(--ring)}
  .nowbtn{margin-left:8px; font-size:11px; font-weight:700; letter-spacing:.6px; text-transform:uppercase;
    color:var(--line); background:none; border:none; cursor:pointer; padding:0}
  .swaprow{display:flex; justify-content:center; padding:0 22px 6px}
  .swaprow button{width:40px; height:40px; border-radius:50%; border:1.5px solid var(--edge);
    background:var(--paper-2); color:var(--line); cursor:pointer; display:flex; align-items:center; justify-content:center}
  .opts{padding:0 22px 22px; display:flex; flex-direction:column; gap:12px}
  .opt{border:1.5px solid var(--edge); border-radius:16px; overflow:hidden; background:var(--paper-2)}
  .opt{cursor:pointer}
  .opt:hover{border-color:var(--line)}
  .opt.sel{border-color:var(--line); box-shadow:0 0 0 3px var(--ring)}
  .opt.sel .opt-badge::after{content:" · haritada"; font-weight:700; opacity:.85}
  .opt.best{border-color:var(--line); box-shadow:0 0 0 3px var(--ring)}
  .opt-head{display:flex; align-items:center; gap:12px; padding:14px 16px; background:var(--card)}
  .opt-badge{font-size:10px; font-weight:800; letter-spacing:.8px; text-transform:uppercase;
    color:#fff; background:var(--line); border-radius:999px; padding:3px 9px}
  .opt.alt .opt-badge{background:var(--faint)}
  .opt-clock{font-family:"Martian Mono",ui-monospace,monospace; font-size:17px; font-weight:700; color:var(--ink)}
  .opt-sum{margin-left:auto; text-align:right; font-size:12.5px; color:var(--faint); line-height:1.5}
  .opt-sum b{display:block; font-size:15px; color:var(--ink)}
  .opt-legs{padding:4px 16px 14px}
  .lrow{display:flex; gap:11px; align-items:flex-start; padding:9px 0; font-size:13.5px}
  .lrow+.lrow{border-top:1px dashed var(--edge)}
  .lcode{flex:none; min-width:62px; text-align:center; font-family:"Martian Mono",ui-monospace,monospace;
    font-size:10.5px; font-weight:700; color:#fff; background:var(--lc,#666); border-radius:6px; padding:4px 6px}
  .lrow.x .lcode{background:var(--paper); color:var(--faint); border:1.5px solid var(--edge)}
  .lbody{flex:1 1 auto; min-width:0}
  .lbody b{font-weight:600}
  .lbody span{display:block; color:var(--faint); font-size:12.5px; margin-top:2px}
  .ltime{flex:none; font-family:"Martian Mono",ui-monospace,monospace; font-size:12px; color:var(--faint); text-align:right}
  .est{display:inline-block; font-size:10px; font-weight:700; letter-spacing:.4px; text-transform:uppercase;
    color:var(--faint); border:1px solid var(--edge); border-radius:4px; padding:1px 4px; margin-left:6px}
  .maprow{padding:0 22px 18px}
  .mapbtn{display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600;
    color:var(--line); background:var(--paper-2); border:1.5px solid var(--edge); border-radius:999px;
    padding:9px 16px; cursor:pointer; transition:background .15s, border-color .15s}
  .mapbtn:hover{background:var(--line-soft); border-color:var(--line)}
  #map{display:none; height:340px; margin-top:12px; border:1.5px solid var(--edge); border-radius:16px; overflow:hidden}
  #map.on{display:block}
  .leaflet-container{background:var(--paper-2); font:inherit}
  .mapnote{font-size:11.5px; color:var(--faint); margin-top:8px}
  .warn{display:flex; gap:10px; align-items:flex-start; margin:0 22px 14px; padding:12px 14px;
    border:1.5px solid var(--line); border-radius:14px; background:var(--line-soft); font-size:13.5px; line-height:1.5}
  .warn b{display:block}
  .warn i{font-style:normal; flex:none; font-size:15px}
  .lchips{display:flex; flex-wrap:wrap; gap:6px; margin-top:14px}
  .lchip{font-family:"Martian Mono",ui-monospace,monospace; font-size:10.5px; font-weight:700; color:#fff;
    background:var(--lc); border-radius:5px; padding:3px 7px}
  @media (max-width:560px){
    .plan{grid-template-columns:1fr; gap:12px}
    .plan .field.when{min-width:0}
  }
</style>
</head>
<body>
<main class="wrap">
  <div class="topline"></div>
  <header>
    <div class="kicker">
      <span class="roundel">İST</span>
      <span class="kt">Metro · Marmaray · Metrobüs<b>Yolculuk Planlayıcı</b></span>
    </div>
    <h1>Kaç dakika, <em>kaçta varırım,</em> kaç lira?</h1>
    <p class="lede">Nereden nereye ve kaçta çıkacağını seç; varış saatini, aktarmaları ve toplam ücreti dakika dakika gör. Sadece raylı sistem ve metrobüs — sade, hızlı.</p>
    <div class="lchips">${lineChips}</div>
    <nav class="linenav"><a href="/m11">M11 hat rehberi <i>→</i></a> <a href="/marmaray">Marmaray hat rehberi <i>→</i></a></nav>
  </header>

  <div class="card">
    <div class="plan">
      <div class="field from">
        <label for="from"><b>A</b> Nereden</label>
        <div class="selwrap"><select id="from">${placeOpts(iHav)}</select></div>
      </div>
      <div class="field to">
        <label for="to"><b>B</b> Nereye</label>
        <div class="selwrap"><select id="to">${placeOpts(iUsk)}</select></div>
      </div>
      <div class="field when">
        <label for="when">Kalkış<button type="button" class="nowbtn" id="nowbtn">şimdi</button></label>
        <input type="time" id="when" value="08:30">
      </div>
    </div>
    <div class="swaprow">
      <button id="swap" type="button" aria-label="Yönü değiştir" title="Yönü değiştir">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/></svg>
      </button>
    </div>
    <div id="warn"></div>
    <div class="opts" id="opts"></div>
    <div class="maprow">
      <button class="mapbtn" id="mapbtn" type="button">🗺️ Rotayı haritada göster</button>
      <div id="map"></div>
      <p class="mapnote" id="mapnote"></p>
    </div>
    <p class="note" id="note"></p>
  </div>

  <h2>Nasıl hesaplanıyor?</h2>
  <p class="sub">Açık olmak, kesin görünmekten daha faydalı.</p>
  ${faqHTML}

  <p class="foot">
    <b>Gayriresmî araçtır.</b> M11 ve Marmaray süreleri TCDD tarifesinden türetilmiştir; metro ve metrobüs süreleri hat toplam süresinin mesafeye dağıtılmasıyla <b>tahmin edilmiştir</b>. Ücretler İBB/UKOME 20.07.2026 tarifesindendir. Yolculuk öncesi
    <a href="https://www.tcddtasimacilik.gov.tr" rel="noopener">tcddtasimacilik.gov.tr</a>,
    <a href="https://www.metro.istanbul" rel="noopener">metro.istanbul</a> ve
    <a href="https://tuhim.ibb.gov.tr" rel="noopener">İBB ücret tarifesi</a> sayfalarını kontrol edin.
  </p>
</main>

<script>
(function(){
  var NET = ${JSON.stringify(NETWORK)};
  var FLAT = ${JSON.stringify(FLAT)};
  var L = NET.L, P = NET.P, X = NET.X;
  var $ = function(id){ return document.getElementById(id); };
  var fromEl = $("from"), toEl = $("to"), whenEl = $("when"), optsEl = $("opts"), noteEl = $("note");

  // --- düğüm dizini -------------------------------------------------------
  var nodes = [], nidx = {};
  Object.keys(L).forEach(function(ln){
    L[ln].n.forEach(function(_, i){ nidx[ln + ":" + i] = nodes.length; nodes.push([ln, i]); });
  });
  // komşuluk: hat boyunca + aktarma
  var adj = nodes.map(function(){ return []; });
  Object.keys(L).forEach(function(ln){
    var t = L[ln].t;
    for(var i = 0; i + 1 < t.length; i++){
      var a = nidx[ln+":"+i], b = nidx[ln+":"+(i+1)], w = Math.max(1, Math.abs(t[i+1]-t[i]));
      adj[a].push([b, w, 0]); adj[b].push([a, w, 0]);
    }
  });
  X.forEach(function(x){
    var a = nidx[x[0]+":"+x[1]], b = nidx[x[2]+":"+x[3]], walk = x[4];
    adj[a].push([b, walk, 1]); adj[b].push([a, walk, 1]);
  });

  function fmt(m){ m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m/60)).padStart(2,"0") + ":" + String(m%60).padStart(2,"0"); }
  function lira(v){ return "₺" + v.toFixed(2).replace(".", ","); }
  function fareDist(ln, stops){ var F = L[ln].fare; for(var k=0;k<F.length;k++){ if(stops<=F[k][0]) return F[k]; } return F[F.length-1]; }

  // --- Dijkstra: çok kaynaklı → çok hedefli ------------------------------
  function search(srcNodes, dstSet, penalty, banned){
    var INF = 1e9, dist = new Array(nodes.length).fill(INF), prev = new Array(nodes.length).fill(-1);
    var seen = new Array(nodes.length).fill(false);
    srcNodes.forEach(function(n){ dist[n] = 0; });
    for(;;){
      var u = -1, best = INF;
      for(var i=0;i<nodes.length;i++) if(!seen[i] && dist[i] < best){ best = dist[i]; u = i; }
      if(u < 0) break;
      seen[u] = true;
      if(dstSet[u]) break;
      for(var k=0;k<adj[u].length;k++){
        var e = adj[u][k], v = e[0];
        if(e[2] && banned && banned[edgeKey(u, v)]) continue;     // yasaklı aktarma
        var w = e[1] + (e[2] ? penalty(nodes[v][0]) : 0);
        if(dist[u] + w < dist[v]){ dist[v] = dist[u] + w; prev[v] = u; }
      }
    }
    var end = -1, bd = INF;
    for(var i=0;i<nodes.length;i++) if(dstSet[i] && dist[i] < bd){ bd = dist[i]; end = i; }
    if(end < 0) return null;
    var path = [];
    for(var c = end; c >= 0; c = prev[c]) path.unshift(c);
    return path;
  }
  function edgeKey(a, b){ return a < b ? a + ":" + b : b + ":" + a; }
  // yoldaki aktarma kenarları (hat değişimi olan ardışık düğüm çiftleri)
  function xferEdges(path){
    var out = [];
    for(var i=1;i<path.length;i++)
      if(nodes[path[i]][0] !== nodes[path[i-1]][0]) out.push(edgeKey(path[i-1], path[i]));
    return out;
  }

  // yol → bacaklar
  function toLegs(path){
    var legs = [];
    for(var i=0;i<path.length;i++){
      var ln = nodes[path[i]][0], idx = nodes[path[i]][1];
      if(legs.length && legs[legs.length-1].ln === ln) legs[legs.length-1].j = idx;
      else legs.push({ ln: ln, i: idx, j: idx });
    }
    return legs.filter(function(g, k){ return !(g.i === g.j && legs.length > 1 && k > 0 && k < legs.length - 1) ; });
  }

  // bacakları saatlendir + ücretlendir
  // --- sefer saatleri ------------------------------------------------------
  // Her hattın ilk/son sefer saati vardır; bunlar dikkate alınmazsa gece 01:00
  // için de rota üretilir. Aşağıdaki yardımcılar bunu engeller.
  function hhmm(s){ var p = String(s || "06:00").split(":"); return (+p[0]) * 60 + (+p[1]); }
  function svc(ln){
    var f = hhmm(L[ln].f), l = hhmm(L[ln].l);
    if(l <= f) l += 1440;              // gece yarısını geçen son sefer
    return { f: f, l: l };
  }
  // Gerçek tarifesi olan hatlarda (GTFS) sıradaki kalkışı DAKİKASIYLA bulur.
  // Aktarmalar fazlıdır: M11 14:26'da varıp Marmaray 14:29'da kalkıyorsa
  // bekleme 3 dk'dır, "sefer aralığı/2" değil. Liste yoksa aralık/2'ye düşer.
  function nextDeparture(ln, i, forward, ready){
    var N = L[ln], list = forward ? N.dA : N.dB;
    if(!list || !list.length) return null;
    var off = forward ? N.t[i] : (N.t[N.t.length - 1] - N.t[i]);
    var day = Math.floor(ready / 1440) * 1440, r = ready - day;
    for(var pass = 0; pass < 2; pass++){
      for(var k = 0; k < list.length; k++){
        var dep = list[k] + off;
        if(dep >= r) return day + dep;
      }
      day += 1440; r = 0;                 // bugün kalmadı → ertesi günün ilk seferi
    }
    return null;
  }

  // m anından itibaren o hattın ilk servis anı (gerekirse ertesi güne taşar)
  function nextSvc(ln, m){
    var s = svc(ln), x = ((m % 1440) + 1440) % 1440, base = m - x;
    if(x < s.f) return base + s.f;
    if(x <= s.l) return m;
    return base + 1440 + s.f;
  }

  function schedule(legs, t0){
    var t = t0, out = [], cost = 0, ogr = 0, sos = 0, flatSeq = 0, est = false;
    var shifted = null, nextDay = false;
    legs.forEach(function(g, k){
      var N = L[g.ln];
      if(g.i === g.j) return;
      var headWait = Math.round(N.h / 2);
      var walk = 0;
      if(k > 0){
        var prev = legs[k-1];
        for(var q=0;q<X.length;q++){
          var x = X[q];
          if((x[0]===prev.ln && x[2]===g.ln) || (x[2]===prev.ln && x[0]===g.ln)){ walk = x[4]; break; }
        }
      }
      var ready = t + walk;
      var exact = nextDeparture(g.ln, g.i, g.j > g.i, ready);
      var dep, wait;
      if(exact !== null){                   // gerçek tarife: dakikasıyla
        dep = exact; wait = exact - ready;
        if(wait > 90){ if(shifted === null) shifted = { ln: g.ln, at: exact }; nextDay = true; }
        var ride0 = Math.abs(N.t[g.j] - N.t[g.i]);
        var arr0 = dep + ride0, stops0 = Math.abs(g.j - g.i), f0;
        if(N.fare){ var F0 = fareDist(g.ln, stops0); f0 = { tam: F0[1], ogr: F0[2], sos: F0[3] }; flatSeq = 0; }
        else { var s0 = Math.min(flatSeq, FLAT.length - 1); f0 = FLAT[s0]; flatSeq++; }
        cost += f0.tam; ogr += f0.ogr; sos += f0.sos;
        var est0 = !(N.k === "tcdd" || N.src === "gtfs");
        if(est0) est = true;
        out.push({ ln: g.ln, from: N.n[g.i], to: N.n[g.j], iIdx: g.i, jIdx: g.j,
                   dep: dep, arr: arr0, ride: ride0, stops: stops0, walk: walk, wait: wait,
                   fare: f0.tam, est: est0, exact: true });
        t = arr0;
        return;
      }
      var start = nextSvc(g.ln, ready);
      if(start > ready){                    // servis kapalı: ilk sefere kadar bekle
        dep = start; wait = start - ready;
        if(shifted === null) shifted = { ln: g.ln, at: start };
        if(start - ready > 120) nextDay = true;
      } else {
        dep = ready + headWait; wait = headWait;
        var s2 = svc(g.ln), x2 = ((dep % 1440) + 1440) % 1440;
        if(x2 < s2.f) x2 += 1440;
        if(x2 > s2.l){                      // son seferi kaçırdı
          dep = nextSvc(g.ln, dep); wait = dep - ready;
          if(shifted === null) shifted = { ln: g.ln, at: dep };
          nextDay = true;
        }
      }
      var ride = Math.abs(N.t[g.j] - N.t[g.i]);
      var arr = dep + ride;
      var stops = Math.abs(g.j - g.i);
      var f;
      if(N.fare){ var F = fareDist(g.ln, stops); f = { tam: F[1], ogr: F[2], sos: F[3] }; flatSeq = 0; }
      else { var s = Math.min(flatSeq, FLAT.length - 1); f = FLAT[s]; flatSeq++; }
      cost += f.tam; ogr += f.ogr; sos += f.sos;
      var estL = !(N.k === "tcdd" || N.src === "gtfs");
      if(estL) est = true;
      out.push({ ln: g.ln, from: N.n[g.i], to: N.n[g.j], iIdx: g.i, jIdx: g.j,
                 dep: dep, arr: arr, ride: ride, stops: stops, walk: walk, wait: wait,
                 fare: f.tam, est: estL });
      t = arr;
    });
    return { legs: out, t0: t0, arr: t, total: t - t0, cost: cost, ogr: ogr, sos: sos,
             est: est, shifted: shifted, nextDay: nextDay };
  }

  function render(plan, badge, cls, k){
    if(!plan || !plan.legs.length) return "";
    var rows = plan.legs.map(function(g){
      var pre = [];
      if(g.walk) pre.push(g.walk + " dk yürüme");
      pre.push("~" + g.wait + " dk bekleme");
      return '<div class="lrow x"><span class="lcode">⇄</span><span class="lbody">' +
             (g.walk ? "Aktarma" : "Bekleme") + '<span>' + pre.join(" + ") + '</span></span>' +
             '<span class="ltime">' + fmt(g.dep - g.walk - g.wait) + '</span></div>' +
             '<div class="lrow" style="--lc:' + L[g.ln].c + '"><span class="lcode">' + g.ln + '</span>' +
             '<span class="lbody"><b>' + g.from + " → " + g.to + '</b>' +
             '<span>' + g.ride + " dk · " + g.stops + " durak · " + lira(g.fare) +
             (g.est ? '<i class="est">tahmini</i>' : '') + '</span></span>' +
             '<span class="ltime">' + fmt(g.dep) + "<br>" + fmt(g.arr) + '</span></div>';
    }).join("");
    return '<div class="opt ' + cls + (k === 0 ? " sel" : "") + '" data-opt="' + k + '" role="button" tabindex="0"><div class="opt-head">' +
      '<span class="opt-badge">' + badge + '</span>' +
      '<span class="opt-clock">' + fmt(plan.t0) + " → " + fmt(plan.arr) + '</span>' +
      '<span class="opt-sum"><b>' + plan.total + " dk · " + lira(plan.cost) + '</b>' +
      (plan.legs.length - 1 > 0 ? (plan.legs.length - 1) + " aktarma" : "aktarmasız") +
      ' · Öğr. ' + lira(plan.ogr) + '</span></div>' +
      '<div class="opt-legs">' + rows + '</div></div>';
  }

  function calc(){
    var a = P[+fromEl.value], b = P[+toEl.value];
    var src = a.m.map(function(m){ return nidx[m[0]+":"+m[1]]; });
    var dstSet = {}; b.m.forEach(function(m){ dstSet[nidx[m[0]+":"+m[1]]] = 1; });
    if(src.some(function(n){ return dstSet[n]; })){
      optsEl.innerHTML = ""; noteEl.textContent = "Kalkış ve varış aynı yer. Farklı bir durak seçin."; return;
    }
    var parts = (whenEl.value || "08:30").split(":");
    var t0 = (+parts[0]) * 60 + (+parts[1]);

    // --- aday rotalar -----------------------------------------------------
    // Tek bir Dijkstra tek yol verir; farklı ceza katsayıları çoğu zaman aynı
    // yolu bulur. Gerçek çeşitlilik için en iyi rotanın kullandığı aktarma
    // kenarlarını sırayla yasaklayıp yeniden arıyoruz (Yen'in yöntemine yakın).
    var cands = [], seenSig = {};
    function addCand(path){
      if(!path) return null;
      var legs = toLegs(path).filter(function(g){ return g.i !== g.j; });
      if(!legs.length) return null;
      var sig = legs.map(function(g){ return g.ln + ":" + g.i + ">" + g.j; }).join("|");
      if(seenSig[sig]) return null;
      seenSig[sig] = 1;
      var pl = schedule(legs, t0);
      pl.sig = sig; pl.path = path;
      cands.push(pl);
      return pl;
    }
    var base = search(src, dstSet, function(){ return 4; });
    addCand(base);
    addCand(search(src, dstSet, function(){ return 30; }));                     // az aktarmalı
    addCand(search(src, dstSet, function(ln){ return L[ln].fare ? 4 : 14; }));  // ücret duyarlı
    // Kademeli yasaklama: bulunan her rotanın aktarmalarını yasaklayıp yeniden
    // ara. Böylece 2., 3. koridora da inilir — tek turda yalnızca komşu rota
    // bulunuyordu ve farklı hatlardan geçen seçenekler hiç görünmüyordu.
    var banned = {};
    for(var round = 0; round < 5 && cands.length < 8; round++){
      var p = search(src, dstSet, function(){ return 4; }, banned);
      if(!p) break;
      addCand(p);
      var es = xferEdges(p);
      if(!es.length) break;
      es.forEach(function(e){ banned[e] = 1; });
    }
    if(!cands.length){ optsEl.innerHTML = '<p class="note">Rota bulunamadı.</p>'; $("warn").innerHTML = ""; lastPlan = null; return; }

    cands.sort(function(a, b){ return a.total - b.total; });
    var pf = cands[0];
    var baseLines = {}; pf.legs.forEach(function(g){ baseLines[g.ln] = 1; });
    var minX = Math.min.apply(null, cands.map(function(c){ return c.legs.length - 1; }));
    var minC = Math.min.apply(null, cands.map(function(c){ return c.cost; }));

    // Alternatifleri yalnızca süreye göre değil, FARKLILIĞA göre de seç:
    // farklı hat kullanan bir rota biraz uzun olsa da gösterilmeye değer.
    cands.slice(1).forEach(function(c){
      c.extra = c.total - pf.total;
      c.fewer = (c.legs.length - 1) < (pf.legs.length - 1) && (c.legs.length - 1) === minX;
      c.cheaper = c.cost < pf.cost - 0.01 && c.cost <= minC + 0.01;
      c.newLines = c.legs.map(function(g){ return g.ln; }).filter(function(ln){ return !baseLines[ln]; });
      c.score = c.extra - (c.fewer ? 18 : 0) - (c.cheaper ? 12 : 0) - (c.newLines.length ? 10 : 0);
    });
    var alts = cands.slice(1).filter(function(c){ return c.extra <= 35; })
                    .sort(function(a, b){ return a.score - b.score; });
    var shown = [{ pl: pf, badge: "En hızlı", cls: "best" }];
    var usedSig = {}; usedSig[pf.sig] = 1;
    var seenLineSet = {}; seenLineSet[Object.keys(baseLines).sort().join("+")] = 1;
    alts.forEach(function(c){
      if(shown.length >= 3 || usedSig[c.sig]) return;
      var ls = c.legs.map(function(g){ return g.ln; }).sort().join("+");
      if(seenLineSet[ls]) return;                     // aynı hat kümesini tekrarlama
      seenLineSet[ls] = 1; usedSig[c.sig] = 1;
      var badge = c.fewer ? "Daha az aktarma"
                : c.cheaper ? "Daha ucuz"
                : c.newLines.length ? c.newLines[0] + " üzerinden"
                : "Alternatif";
      shown.push({ pl: c, badge: badge, cls: "alt" });
    });
    // Seçim farklılık skoruna göre yapıldı; GÖSTERİM süreye göre sıralanır,
    // yoksa 92 dk'lık seçenek 77 dk'lığın üstünde görünebiliyor.
    var head = shown.shift();
    shown.sort(function(a, b){ return a.pl.total - b.pl.total; });
    shown.unshift(head);
    shownPlans = shown.map(function(s){ return s.pl; });
    var html = shown.map(function(s, k){ return render(s.pl, s.badge, s.cls, k); }).join("");
    optsEl.innerHTML = html;
    lastPlan = shownPlans[0]; if(mapReady) drawMap();
    var w = $("warn"); w.innerHTML = "";
    if(pf && pf.shifted){
      var s = pf.shifted;
      w.innerHTML = '<div class="warn"><i>🕐</i><span><b>Seçtiğin saatte ' + s.ln + ' seferi yok.</b>' +
        'Hat ' + L[s.ln].f + " – " + L[s.ln].l + ' arasında çalışıyor; plan ilk sefere (' + fmt(s.at) + ') göre hesaplandı' +
        (pf.nextDay ? ' — ertesi güne sarkıyor.' : '.') +
        ' M11 ve Marmaray Cuma/Cumartesi geceleri ek sefer yapar; bu ek seferler hesaba katılmaz.</span></div>';
    }
    noteEl.innerHTML = (pf && pf.est
      ? "Metro ve metrobüs süreleri <b>tahminidir</b> (istasyon bazlı tarife yayımlanmıyor); M11 ve Marmaray gerçek tarifeden gelir. "
      : "Süreler TCDD tarifesinden. ") +
      "Bekleme, gerçek tarifesi olan hatlarda sıradaki kalkışa göre dakikasıyla; diğerlerinde sefer aralığının yarısı olarak hesaplanır. " +
      "Mesafe bazlı hatlarda (M11, Marmaray, Metrobüs) aktarma indirimi uygulanmaz.";
  }

  // --- OpenStreetMap (Leaflet) — yalnızca istenince yüklenir ---------------
  // Harita sayfa açılışında yüklenmez: Leaflet + karo istekleri ancak kullanıcı
  // düğmeye bastığında yapılır. Böylece sayfa bağımlılıksız ve hızlı kalır.
  var map = null, layer = null, mapReady = false, lastPlan = null, shownPlans = [];
  function loadLeaflet(cb){
    if(window.L && window.L.map) return cb();   // zaten yüklü
    var css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    var js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = cb;
    js.onerror = function(){ $("mapnote").textContent = "Harita yüklenemedi (ağ engeli olabilir). Hesaplama etkilenmez."; };
    document.head.appendChild(js);
  }
  function drawMap(){
    // DİKKAT: yerel "L" hat verisidir; Leaflet global L'yi gölgeler.
    // Leaflet'e her zaman window.L üzerinden erişilir.
    var LF = window.L;
    if(!mapReady || !lastPlan || !LF || !LF.map) return;
    if(!map){
      map = LF.map("map", { scrollWheelZoom: false });
      LF.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18, attribution: "© OpenStreetMap katkıcıları"
      }).addTo(map);
    }
    if(layer) map.removeLayer(layer);
    layer = LF.layerGroup().addTo(map);
    var all = [];
    lastPlan.legs.forEach(function(g){
      var N = L[g.ln], lo = Math.min(g.iIdx, g.jIdx), hi = Math.max(g.iIdx, g.jIdx);
      var pts = N.p.slice(lo, hi + 1);
      var names = N.n.slice(lo, hi + 1);
      if(g.iIdx > g.jIdx){ pts = pts.slice().reverse(); names = names.slice().reverse(); }
      all = all.concat(pts);
      LF.polyline(pts, { color: N.c, weight: 5, opacity: .85 }).addTo(layer);
      pts.forEach(function(p, k){
        var edge = (k === 0 || k === pts.length - 1);
        LF.circleMarker(p, { radius: edge ? 6 : 3.5, color: N.c, weight: edge ? 3 : 2,
          fillColor: "#fff", fillOpacity: 1 }).addTo(layer)
          .bindPopup("<b>" + names[k] + "</b><br>" + g.ln);
      });
    });
    if(all.length) map.fitBounds(LF.latLngBounds(all).pad(0.12));
    $("mapnote").innerHTML = 'Karolar © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> katkıcıları. ' +
      'Çizgiler istasyon koordinatlarını birleştirir; gerçek hat güzergâhı değildir.';
  }
  // Seçenek kartına tıklayınca o rota haritaya çizilir.
  function selectOpt(k){
    if(!shownPlans[k]) return;
    lastPlan = shownPlans[k];
    var cards = optsEl.getElementsByClassName("opt");
    for(var i=0;i<cards.length;i++) cards[i].classList.toggle("sel", +cards[i].getAttribute("data-opt") === k);
    if(!mapReady){ $("mapbtn").click(); return; }        // ilk tıklamada haritayı aç
    $("map").classList.add("on");
    $("mapbtn").textContent = "🗺️ Haritayı gizle";
    setTimeout(function(){ map && map.invalidateSize(); drawMap(); }, 60);
  }
  optsEl.addEventListener("click", function(e){
    var card = e.target.closest ? e.target.closest(".opt") : null;
    if(card) selectOpt(+card.getAttribute("data-opt"));
  });
  optsEl.addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var card = e.target.closest ? e.target.closest(".opt") : null;
    if(card){ e.preventDefault(); selectOpt(+card.getAttribute("data-opt")); }
  });

  $("mapbtn").addEventListener("click", function(){
    var el = $("map");
    if(mapReady){ el.classList.toggle("on"); this.textContent = el.classList.contains("on") ? "🗺️ Haritayı gizle" : "🗺️ Rotayı haritada göster"; if(el.classList.contains("on")) setTimeout(function(){ map && map.invalidateSize(); drawMap(); }, 60); return; }
    var btn = this; btn.textContent = "Harita yükleniyor…";
    loadLeaflet(function(){
      mapReady = true; el.classList.add("on"); btn.textContent = "🗺️ Haritayı gizle";
      drawMap();
    });
  });

  fromEl.addEventListener("change", calc);
  toEl.addEventListener("change", calc);
  whenEl.addEventListener("change", calc);
  $("swap").addEventListener("click", function(){ var t = fromEl.value; fromEl.value = toEl.value; toEl.value = t; calc(); });
  $("nowbtn").addEventListener("click", function(){
    var d = new Date();
    whenEl.value = String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
    calc();
  });
  calc();
})();
</script>
</body>
</html>`;
}

const PAGES = { "/": buildPlanner(), "/m11": buildPage(LINES.m11), "/marmaray": buildPage(LINES.b1) };

const ROBOTS = "User-agent: *\nAllow: /\nSitemap: " + SITE + "/sitemap.xml\n";
const SITEMAP = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  '  <url><loc>' + SITE + '/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n' +
  Object.values(LINES).map(l =>
    "  <url><loc>" + SITE + l.path + "</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n").join("") +
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
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const body = PAGES[path];
    if (!body) return new Response("Sayfa bulunamadı", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    return new Response(body, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  },
};
