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
    id: "m11", code: "M11", path: "/", stations: M11_STATIONS, fares: M11_FARE, free: M11_FREE,
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
</style>
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

const PAGES = { "/": buildPage(LINES.m11), "/marmaray": buildPage(LINES.b1) };

const ROBOTS = "User-agent: *\nAllow: /\nSitemap: " + SITE + "/sitemap.xml\n";
const SITEMAP = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  Object.values(LINES).map(l =>
    "  <url><loc>" + SITE + l.path + "</loc><changefreq>weekly</changefreq><priority>" +
    (l.path === "/" ? "1.0" : "0.9") + "</priority></url>\n").join("") +
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
