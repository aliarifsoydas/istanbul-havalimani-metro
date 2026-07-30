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
const NETWORK = {"L":{"M1A":{"n":["Yenikapı","Aksaray","Emniyet – Fatih","Topkapı – Ulubatlı","Bayrampaşa – Maltepe","Sağmalcılar","Kocatepe","Otogar","Terazidere","Davutpaşa – YTÜ","Merter","Zeytinburnu","Bakırköy – İncirli","Bahçelievler","Ataköy – Şirinevler","Yenibosna","DTM – Fuar Merkezi","Atatürk Havalimanı"],"km":[0.0,0.95,1.95,3.05,4.55,5.95,7.34,8.33,9.52,10.68,12.25,13.16,14.56,15.67,17.25,18.12,18.91,19.98],"t":[0,1,2,4,6,7,9,10,12,13,15,16,18,20,22,23,24,25],"h":6,"f":"05:50","l":"00:00","k":"metro","c":"#e11b22"},"M1B":{"n":["Yenikapı","Aksaray","Emniyet – Fatih","Topkapı – Ulubatlı","Bayrampaşa – Maltepe","Sağmalcılar","Kocatepe","Otogar","Esenler","Menderes","Üçyüzlü","Bağcılar Meydan","Kirazlı"],"km":[0.0,0.95,1.95,3.05,4.55,5.95,7.34,8.33,8.94,10.01,11.01,12.32,13.54],"t":[0,2,5,8,12,15,19,22,23,26,28,32,35],"h":6,"f":"06:00","l":"00:03","k":"metro","c":"#e11b22"},"M2":{"n":["Yenikapı","Vezneciler","Haliç","Şişhane","Taksim","Osmanbey","Mecidiyeköy","Gayrettepe","Levent","4. Levent","Sanayi Mahallesi","Seyrantepe","İTÜ – Ayazağa","Atatürk Oto Sanayi","Darüşşafaka","Hacıosman"],"km":[0.0,1.08,2.47,3.37,5.03,6.74,8.18,9.89,10.84,12.07,13.07,14.09,16.31,17.54,18.88,20.17],"t":[0,2,4,5,8,11,13,16,17,19,21,22,26,28,30,32],"h":6,"f":"05:57","l":"00:00","k":"metro","c":"#00a04b"},"M3":{"n":["Bakırköy Sahil","Özgürlük Meydanı","İncirli","Haznedar","İlkyuva","Yıldıztepe","Molla Gürani","Kirazlı","Yenimahalle","Mahmutbey","İSTOÇ","İkitelli Sanayi","Turgut Özal","Siteler","Başak Konutları","Başakşehir-Metrokent","Onurkent","Şehir Hastanesi","Toplu Konutlar","Kayaşehir Merkez"],"km":[0.0,1.08,2.93,4.06,4.8,6.06,7.08,8.01,9.14,10.91,12.17,14.45,15.57,16.4,17.61,19.09,20.3,21.92,22.93,24.41],"t":[0,2,5,7,9,11,13,15,17,20,22,27,29,30,32,35,37,40,42,45],"h":6,"f":"06:00","l":"00:00","k":"metro","c":"#00adef"},"M4":{"n":["Kadıköy","Ayrılık Çeşmesi","Acıbadem","Ünalan","Göztepe","Yenisahra","Pegasus-Kozyatağı","Bostancı","Küçükyalı","Maltepe","Huzurevi","Gülsuyu","Esenkent[2]","Hastane – Adliye","Soğanlık","Kartal","Yakacık-Adnan Kahveci","Pendik","Tavşantepe","Fevzi Çakmak-Hastane","Yayalar – Şeyhli","Kurtköy","Sabiha Gökçen Havalimanı"],"km":[0.0,1.34,2.64,4.23,5.16,7.2,8.65,9.92,12.49,14.33,15.51,16.63,17.58,18.77,20.12,21.89,23.74,25.14,26.31,27.77,29.94,31.97,33.29],"t":[0,2,4,7,8,11,14,15,20,22,24,26,27,29,31,34,37,39,41,43,47,50,52],"h":6,"f":"06:00","l":"23:59","k":"metro","c":"#e56db1"},"M5":{"n":["Üsküdar","Fıstıkağacı","Bağlarbaşı","Altunizade","Kısıklı","Bulgurlu","Ümraniye","Çarşı","Yamanevler","Çakmak","Ihlamurkuyu","Altınşehir","İmam Hatip Lisesi","Dudullu","Necip Fazıl","Çekmeköy","Meclis","Sarıgazi","Sancaktepe Şehir Hastanesi","Sancaktepe","Samandıra Merkez","Veysel Karani","Hasanpaşa","Sultanbeyli"],"km":[0.0,1.24,2.23,3.11,4.66,6.05,7.31,8.41,9.47,10.36,11.54,12.26,13.49,14.39,15.89,16.81,17.82,19.01,20.04,21.74,22.64,22.64,22.64,22.64],"t":[0,2,4,6,9,11,14,16,18,19,21,23,25,27,29,31,33,35,37,40,42,42,42,42],"h":6,"f":"06:00","l":"00:01","k":"metro","c":"#8e4b9e"},"M6":{"n":["Levent","Nispetiye","Etiler","Hisarustu-Bogazici Universitesi"],"km":[0.0,0.76,2.22,3.0],"t":[0,2,5,7],"h":6,"f":"06:00","l":"23:59","k":"metro","c":"#c9a227"},"M7":{"n":["Yıldız","Fulya","Mecidiyeköy","Çağlayan","Kâğıthane","Nurtepe","Alibeyköy","Çırçır","Veysel Karani – Akşemsettin","Yeşilpınar","Kâzım Karabekir","Yenimahalle","Karadeniz Mahallesi","Giyimkent – Tekstilkent","Oruç Reis","Göztepe Mahallesi","Mahmutbey"],"km":[0.0,0.8,2.03,3.47,4.7,5.53,6.74,7.78,8.5,9.01,11.47,12.85,14.45,15.88,17.26,18.21,19.95],"t":[0,1,4,6,9,10,13,14,16,17,21,24,27,29,32,34,37],"h":6,"f":"00:25","l":"23:59","k":"metro","c":"#e2338a"},"M8":{"n":["Bostancı","Emin Ali Paşa","Ayşekadın","Kozyatağı","Küçükbakkalköy","İçerenköy","Kayışdağı","Mevlana","İmes","Modoko-Keyap","Dudullu","Huzur","Parseller"],"km":[0.0,1.13,2.09,3.55,4.81,6.12,7.33,8.98,9.91,10.96,11.9,12.76,14.02],"t":[0,2,4,7,9,11,14,17,18,20,22,24,26],"h":6,"f":"06:00","l":"00:00","k":"metro","c":"#8d6e3a"},"M9":{"n":["Ataköy","Yenibosna","Çobançeşme","29 Ekim – Cumhuriyet","Doğu Sanayi","Mimar Sinan","15 Temmuz","Halkalı Caddesi","Atatürk Mahallesi","Bahariye","Masko","İkitelli Sanayi","Ziya Gökalp Mahallesi","Olimpiyat"],"km":[0.0,1.98,3.8,4.65,5.67,6.88,8.28,9.52,10.62,11.31,12.11,12.96,14.53,16.23],"t":[0,4,7,9,10,13,15,18,20,21,22,24,27,30],"h":6,"f":"06:00","l":"00:00","k":"metro","c":"#f5a01d"},"M11":{"n":["Gayrettepe","Kâğıthane","Hasdal","Kemerburgaz","Göktürk","İhsaniye","İstanbul Havalimanı","Kargo Terminali","Taşoluk","Arnavutköy Hastane","İbn Haldun Üniversitesi","Kayaşehir","Olimpiyatköy","Halkalı Stadı","Halkalı"],"km":[0,3.94,9.43,15.03,18.16,28.11,34.1,36.61,43.01,47.34,54.24,58.05,62.48,64.95,69.11],"t":[0,4,9,13,17,24,30,34,39,43,49,52,57,60,64],"h":15,"f":"05:55","l":"23:55","k":"tcdd","c":"#00a3a3","fare":[[3,37.4,18.13,26.58],[6,42.34,20.8,30.45],[8,47.89,23.39,34.16],[10,53.74,25.97,37.87],[12,59.9,28.55,41.58],[14,66.39,31.13,45.3]]},"Marmaray":{"n":["Halkalı","Mustafa Kemal","Küçükçekmece","Florya","Florya Akvaryum","Yeşilköy","Yeşilyurt","Ataköy","Bakırköy","Yenimahalle","Zeytinburnu-Fişekhane","Kazlıçeşme","Yenikapı","Sirkeci","Üsküdar","Ayrılık Çeşmesi","Söğütlüçeşme","Feneryolu","Göztepe","Erenköy","Suadiye","Bostancı","Küçükyalı","İdealtepe","Süreyya Plajı","Maltepe","Cevizli","Atalar","Başak","Kartal","Yunus","Pendik","Kaynarca","Tersane","Güzelyalı","Aydıntepe","İçmeler","Tuzla","Çayırova","GTÜ-Fatih","Osmangazi","Darıca","Gebze"],"km":[0,1.59,3.65,5.92,6.95,9.51,10.64,13.08,14.54,15.32,17.55,18.86,22.27,24.74,28.35,31.68,32.96,34.7,35.94,37.46,38.95,40.1,41.58,42.75,44.33,45.45,47.75,49.63,50.81,52.05,53.83,55.79,58.2,60.16,61.21,62.23,63.22,65.92,69.13,70.65,72.42,73.8,75.77],"t":[0,3,5,8,10,13,15,18,21,23,26,28,32,35,39,43,46,48,50,52,55,57,60,62,64,66,69,71,73,75,78,81,84,86,88,90,92,95,98,101,103,105,107],"h":15,"f":"05:58","l":"23:28","k":"tcdd","c":"#0a5c9e","fare":[[7,37.4,18.13,26.58],[14,47.74,22.32,32.92],[21,55.11,26.58,38.72],[28,63.56,30.23,45.08],[35,74.24,35.53,53.02],[43,82.17,37.13,57.29]]},"Metrobüs":{"n":["Beylikdüzü Son Durak","Beykent","Cumhuriyet Mahallesi","Beylikdüzü Belediye","Beylikdüzü","Güzelyurt","Haramidere","Haramidere Sanayi","Saadetdere Mahallesi","Mustafa Kemal Paşa","Cihangir Üniv. Mah.","Avcılar (İÜ Kampüsü)","Şükrübey","İBB Sosyal Tesisler","Küçükçekmece","Cennet Mahallesi","Florya","Beşyol","Sefaköy","Yenibosna","Şirinevler","Bahçelievler","İncirli","Zeytinburnu","Merter","Cevizlibağ","Topkapı","Bayrampaşa – Maltepe","Adnan Menderes Blv.","Edirnekapı","Ayvansaray","Halıcıoğlu","Okmeydanı","Darülaceze – Perpa","Okmeydanı Hastane","Çağlayan","Mecidiyeköy","Zincirlikuyu","Boğaziçi Köprüsü","Burhaniye","Altunizade","Acıbadem","Uzunçayır","Fikirtepe","Söğütlüçeşme"],"km":[0.0,0.0,1.01,1.82,2.56,3.37,4.07,5.17,6.05,7.36,8.31,9.27,10.22,11.95,13.68,14.84,15.39,16.46,17.05,20.35,21.36,23.0,23.84,25.08,26.32,27.88,28.53,29.19,29.84,30.49,31.69,32.89,34.5,35.4,36.3,36.74,37.64,39.6,42.11,44.62,45.86,46.9,48.78,49.85,50.72],"t":[0,0,2,4,5,7,8,10,12,15,17,18,20,24,27,30,31,33,34,41,43,46,47,50,52,56,57,58,59,61,63,65,69,70,72,73,75,79,84,89,91,93,97,99,101],"h":2,"f":"06:00","l":"23:59","k":"metrobus","c":"#c62828","fare":[[1,33.08,14.58,20.47],[2,39.57,15.87,24.46],[3,46.2,18.48,28.35],[9,52.81,21.09,33.08],[15,58.0,22.55,33.54],[21,60.69,22.55,35.66],[27,62.67,22.55,35.66],[33,64.03,22.55,37.61],[43,68.59,22.55,37.61]]}},"X":[["M1A",0,"M1B",0,2],["M1A",0,"M2",0,2],["M1A",0,"Marmaray",12,2],["M1A",1,"M1B",1,2],["M1A",2,"M1B",2,2],["M1A",3,"M1B",3,2],["M1A",4,"M1B",4,2],["M1A",5,"M1B",5,2],["M1A",6,"M1B",6,2],["M1A",7,"M1B",7,2],["M1A",10,"Metrobüs",24,2],["M1A",12,"M3",2,2],["M1A",12,"Metrobüs",22,3],["M1A",13,"Metrobüs",21,2],["M1A",14,"Metrobüs",20,2],["M1A",15,"M9",1,2],["M1A",15,"Metrobüs",19,5],["M1B",0,"M2",0,2],["M1B",0,"Marmaray",12,2],["M1B",12,"M3",7,2],["M2",0,"Marmaray",12,2],["M2",6,"M7",2,3],["M2",6,"Metrobüs",36,4],["M2",7,"M11",0,3],["M2",7,"Metrobüs",37,5],["M2",8,"M6",0,2],["M3",1,"Marmaray",8,3],["M3",2,"Metrobüs",22,3],["M3",9,"M7",16,2],["M3",11,"M9",11,2],["M3",19,"M11",11,4],["M4",1,"Marmaray",15,2],["M4",6,"M8",3,2],["M5",0,"Marmaray",14,2],["M5",3,"Metrobüs",40,4],["M5",13,"M8",10,2],["M7",2,"Metrobüs",36,4],["M7",4,"M11",1,4],["M9",0,"Marmaray",7,2],["M9",13,"M11",12,2],["M11",0,"Metrobüs",37,2],["M11",14,"Marmaray",0,3],["Marmaray",2,"Metrobüs",14,5],["Marmaray",16,"Metrobüs",44,2]],"P":[{"n":"Arnavutköy Hastane","m":[["M11",9]]},{"n":"Zincirlikuyu","m":[["M2",7],["M11",0],["Metrobüs",37]]},{"n":"Göktürk","m":[["M11",4]]},{"n":"Halkalı","m":[["M11",14],["Marmaray",0]]},{"n":"Halkalı Stadı","m":[["M11",13]]},{"n":"Hasdal","m":[["M11",2]]},{"n":"Kâğıthane","m":[["M7",4],["M11",1]]},{"n":"Kargo Terminali","m":[["M11",7]]},{"n":"Kayaşehir Merkez","m":[["M3",19],["M11",11]]},{"n":"Kemerburgaz","m":[["M11",3]]},{"n":"Olimpiyatköy","m":[["M9",13],["M11",12]]},{"n":"Taşoluk","m":[["M11",8]]},{"n":"İbn Haldun Üniversitesi","m":[["M11",10]]},{"n":"İhsaniye","m":[["M11",5]]},{"n":"İstanbul Havalimanı","m":[["M11",6]]},{"n":"Aksaray","m":[["M1A",1],["M1B",1]]},{"n":"Atatürk Havalimanı","m":[["M1A",17]]},{"n":"Bahçelievler","m":[["M1A",13],["Metrobüs",21]]},{"n":"Bakırköy – İncirli","m":[["M1A",12],["M3",2],["Metrobüs",22]]},{"n":"Bayrampaşa – Maltepe","m":[["M1A",4],["M1B",4]]},{"n":"Davutpaşa – YTÜ","m":[["M1A",9]]},{"n":"DTM – Fuar Merkezi","m":[["M1A",16]]},{"n":"Emniyet – Fatih","m":[["M1A",2],["M1B",2]]},{"n":"Kocatepe","m":[["M1A",6],["M1B",6]]},{"n":"Merter","m":[["M1A",10],["Metrobüs",24]]},{"n":"Otogar","m":[["M1A",7],["M1B",7]]},{"n":"Sağmalcılar","m":[["M1A",5],["M1B",5]]},{"n":"Terazidere","m":[["M1A",8]]},{"n":"Topkapı – Ulubatlı","m":[["M1A",3],["M1B",3]]},{"n":"Yenibosna","m":[["M1A",15],["M9",1],["Metrobüs",19]]},{"n":"Yenikapı","m":[["M1A",0],["M1B",0],["M2",0],["Marmaray",12]]},{"n":"Zeytinburnu","m":[["M1A",11]]},{"n":"Ataköy – Şirinevler","m":[["M1A",14],["Metrobüs",20]]},{"n":"Bağcılar Meydan","m":[["M1B",11]]},{"n":"Esenler","m":[["M1B",8]]},{"n":"Kirazlı","m":[["M1B",12],["M3",7]]},{"n":"Menderes","m":[["M1B",9]]},{"n":"Üçyüzlü","m":[["M1B",10]]},{"n":"4. Levent","m":[["M2",9]]},{"n":"Atatürk Oto Sanayi","m":[["M2",13]]},{"n":"Darüşşafaka","m":[["M2",14]]},{"n":"Hacıosman","m":[["M2",15]]},{"n":"Haliç","m":[["M2",2]]},{"n":"İTÜ – Ayazağa","m":[["M2",12]]},{"n":"Levent","m":[["M2",8],["M6",0]]},{"n":"Osmanbey","m":[["M2",5]]},{"n":"Sanayi Mahallesi","m":[["M2",10]]},{"n":"Seyrantepe","m":[["M2",11]]},{"n":"Şişhane","m":[["M2",3]]},{"n":"Mecidiyeköy","m":[["M2",6],["M7",2],["Metrobüs",36]]},{"n":"Taksim","m":[["M2",4]]},{"n":"Vezneciler","m":[["M2",1]]},{"n":"Bakırköy Sahil","m":[["M3",0]]},{"n":"Başak Konutları","m":[["M3",14]]},{"n":"Haznedar","m":[["M3",3]]},{"n":"İkitelli Sanayi","m":[["M3",11],["M9",11]]},{"n":"İlkyuva","m":[["M3",4]]},{"n":"İSTOÇ","m":[["M3",10]]},{"n":"Mahmutbey","m":[["M3",9],["M7",16]]},{"n":"Başakşehir-Metrokent","m":[["M3",15]]},{"n":"Molla Gürani","m":[["M3",6]]},{"n":"Onurkent","m":[["M3",16]]},{"n":"Özgürlük Meydanı","m":[["M3",1],["Marmaray",8]]},{"n":"Şehir Hastanesi","m":[["M3",17]]},{"n":"Siteler","m":[["M3",13]]},{"n":"Toplu Konutlar","m":[["M3",18]]},{"n":"Turgut Özal","m":[["M3",12]]},{"n":"Yenimahalle","m":[["M3",8]]},{"n":"Yıldıztepe","m":[["M3",5]]},{"n":"Acıbadem","m":[["M4",2]]},{"n":"Ayrılık Çeşmesi","m":[["M4",1],["Marmaray",15]]},{"n":"Bostancı","m":[["M4",7]]},{"n":"Esenkent[2]","m":[["M4",12]]},{"n":"Fevzi Çakmak-Hastane","m":[["M4",19]]},{"n":"Göztepe","m":[["M4",4]]},{"n":"Gülsuyu","m":[["M4",11]]},{"n":"Hastane – Adliye","m":[["M4",13]]},{"n":"Huzurevi","m":[["M4",10]]},{"n":"Kadıköy","m":[["M4",0]]},{"n":"Kartal","m":[["M4",15]]},{"n":"Pegasus-Kozyatağı","m":[["M4",6],["M8",3]]},{"n":"Küçükyalı","m":[["M4",8]]},{"n":"Kurtköy","m":[["M4",21]]},{"n":"Maltepe","m":[["M4",9]]},{"n":"Pendik","m":[["M4",17]]},{"n":"Sabiha Gökçen Havalimanı","m":[["M4",22]]},{"n":"Soğanlık","m":[["M4",14]]},{"n":"Tavşantepe","m":[["M4",18]]},{"n":"Ünalan","m":[["M4",3]]},{"n":"Yakacık-Adnan Kahveci","m":[["M4",16]]},{"n":"Yayalar – Şeyhli","m":[["M4",20]]},{"n":"Yenisahra","m":[["M4",5]]},{"n":"Altınşehir","m":[["M5",11]]},{"n":"Altunizade","m":[["M5",3],["Metrobüs",40]]},{"n":"Bağlarbaşı","m":[["M5",2]]},{"n":"Bulgurlu","m":[["M5",5]]},{"n":"Çakmak","m":[["M5",9]]},{"n":"Çarşı","m":[["M5",7]]},{"n":"Çekmeköy","m":[["M5",15]]},{"n":"Dudullu","m":[["M5",13],["M8",10]]},{"n":"Fıstıkağacı","m":[["M5",1]]},{"n":"Hasanpaşa","m":[["M5",22]]},{"n":"Ihlamurkuyu","m":[["M5",10]]},{"n":"İmam Hatip Lisesi","m":[["M5",12]]},{"n":"Kısıklı","m":[["M5",4]]},{"n":"Meclis","m":[["M5",16]]},{"n":"Necip Fazıl","m":[["M5",14]]},{"n":"Samandıra Merkez","m":[["M5",20]]},{"n":"Sancaktepe","m":[["M5",19]]},{"n":"Sancaktepe Şehir Hastanesi","m":[["M5",18]]},{"n":"Sarıgazi","m":[["M5",17]]},{"n":"Sultanbeyli","m":[["M5",23]]},{"n":"Ümraniye","m":[["M5",6]]},{"n":"Üsküdar","m":[["M5",0],["Marmaray",14]]},{"n":"Veysel Karani","m":[["M5",21]]},{"n":"Yamanevler","m":[["M5",8]]},{"n":"Etiler","m":[["M6",2]]},{"n":"Hisarustu-Bogazici Universitesi","m":[["M6",3]]},{"n":"Nispetiye","m":[["M6",1]]},{"n":"Alibeyköy","m":[["M7",6]]},{"n":"Çağlayan","m":[["M7",3]]},{"n":"Çırçır","m":[["M7",7]]},{"n":"Fulya","m":[["M7",1]]},{"n":"Göztepe Mahallesi","m":[["M7",15]]},{"n":"Karadeniz Mahallesi","m":[["M7",12]]},{"n":"Kâzım Karabekir","m":[["M7",10]]},{"n":"Nurtepe","m":[["M7",5]]},{"n":"Oruç Reis","m":[["M7",14]]},{"n":"Giyimkent – Tekstilkent","m":[["M7",13]]},{"n":"Veysel Karani – Akşemsettin","m":[["M7",8]]},{"n":"Yenimahalle","m":[["M7",11]]},{"n":"Yeşilpınar","m":[["M7",9]]},{"n":"Yıldız","m":[["M7",0]]},{"n":"Ayşekadın","m":[["M8",2]]},{"n":"Bostancı","m":[["M8",0]]},{"n":"Emin Ali Paşa","m":[["M8",1]]},{"n":"Huzur","m":[["M8",11]]},{"n":"İçerenköy","m":[["M8",5]]},{"n":"İmes","m":[["M8",8]]},{"n":"Kayışdağı","m":[["M8",6]]},{"n":"Küçükbakkalköy","m":[["M8",4]]},{"n":"Mevlana","m":[["M8",7]]},{"n":"Modoko-Keyap","m":[["M8",9]]},{"n":"Parseller","m":[["M8",12]]},{"n":"15 Temmuz","m":[["M9",6]]},{"n":"29 Ekim – Cumhuriyet","m":[["M9",3]]},{"n":"Ataköy","m":[["M9",0],["Marmaray",7]]},{"n":"Atatürk Mahallesi","m":[["M9",8]]},{"n":"Bahariye","m":[["M9",9]]},{"n":"Çobançeşme","m":[["M9",2]]},{"n":"Doğu Sanayi","m":[["M9",4]]},{"n":"Halkalı Caddesi","m":[["M9",7]]},{"n":"Masko","m":[["M9",10]]},{"n":"Mimar Sinan","m":[["M9",5]]},{"n":"Ziya Gökalp Mahallesi","m":[["M9",12]]},{"n":"Atalar","m":[["Marmaray",27]]},{"n":"Aydıntepe","m":[["Marmaray",35]]},{"n":"Başak","m":[["Marmaray",28]]},{"n":"Bostancı","m":[["Marmaray",21]]},{"n":"Cevizli","m":[["Marmaray",26]]},{"n":"Darıca","m":[["Marmaray",41]]},{"n":"Erenköy","m":[["Marmaray",19]]},{"n":"Feneryolu","m":[["Marmaray",17]]},{"n":"Florya","m":[["Marmaray",3]]},{"n":"Florya Akvaryum","m":[["Marmaray",4]]},{"n":"GTÜ-Fatih","m":[["Marmaray",39]]},{"n":"Gebze","m":[["Marmaray",42]]},{"n":"Göztepe","m":[["Marmaray",18]]},{"n":"Güzelyalı","m":[["Marmaray",34]]},{"n":"Kartal","m":[["Marmaray",29]]},{"n":"Kaynarca","m":[["Marmaray",32]]},{"n":"Kazlıçeşme","m":[["Marmaray",11]]},{"n":"Küçükyalı","m":[["Marmaray",22]]},{"n":"Küçükçekmece","m":[["Marmaray",2],["Metrobüs",14]]},{"n":"Maltepe","m":[["Marmaray",25]]},{"n":"Mustafa Kemal","m":[["Marmaray",1]]},{"n":"Osmangazi","m":[["Marmaray",40]]},{"n":"Pendik","m":[["Marmaray",31]]},{"n":"Sirkeci","m":[["Marmaray",13]]},{"n":"Suadiye","m":[["Marmaray",20]]},{"n":"Söğütlüçeşme","m":[["Marmaray",16],["Metrobüs",44]]},{"n":"Süreyya Plajı","m":[["Marmaray",24]]},{"n":"Tersane","m":[["Marmaray",33]]},{"n":"Tuzla","m":[["Marmaray",37]]},{"n":"Yenimahalle","m":[["Marmaray",9]]},{"n":"Yeşilköy","m":[["Marmaray",5]]},{"n":"Yeşilyurt","m":[["Marmaray",6]]},{"n":"Yunus","m":[["Marmaray",30]]},{"n":"Zeytinburnu-Fişekhane","m":[["Marmaray",10]]},{"n":"Çayırova","m":[["Marmaray",38]]},{"n":"İdealtepe","m":[["Marmaray",23]]},{"n":"İçmeler","m":[["Marmaray",36]]},{"n":"Acıbadem","m":[["Metrobüs",41]]},{"n":"Adnan Menderes Blv.","m":[["Metrobüs",28]]},{"n":"Avcılar (İÜ Kampüsü)","m":[["Metrobüs",11]]},{"n":"Ayvansaray","m":[["Metrobüs",30]]},{"n":"Bayrampaşa – Maltepe","m":[["Metrobüs",27]]},{"n":"Beykent","m":[["Metrobüs",1]]},{"n":"Beylikdüzü","m":[["Metrobüs",4]]},{"n":"Beylikdüzü Belediye","m":[["Metrobüs",3]]},{"n":"Beylikdüzü Son Durak","m":[["Metrobüs",0]]},{"n":"Beşyol","m":[["Metrobüs",17]]},{"n":"Boğaziçi Köprüsü","m":[["Metrobüs",38]]},{"n":"Burhaniye","m":[["Metrobüs",39]]},{"n":"Cennet Mahallesi","m":[["Metrobüs",15]]},{"n":"Cevizlibağ","m":[["Metrobüs",25]]},{"n":"Cihangir Üniv. Mah.","m":[["Metrobüs",10]]},{"n":"Cumhuriyet Mahallesi","m":[["Metrobüs",2]]},{"n":"Darülaceze – Perpa","m":[["Metrobüs",33]]},{"n":"Edirnekapı","m":[["Metrobüs",29]]},{"n":"Fikirtepe","m":[["Metrobüs",43]]},{"n":"Florya","m":[["Metrobüs",16]]},{"n":"Güzelyurt","m":[["Metrobüs",5]]},{"n":"Halıcıoğlu","m":[["Metrobüs",31]]},{"n":"Haramidere","m":[["Metrobüs",6]]},{"n":"Haramidere Sanayi","m":[["Metrobüs",7]]},{"n":"Mustafa Kemal Paşa","m":[["Metrobüs",9]]},{"n":"Okmeydanı","m":[["Metrobüs",32]]},{"n":"Okmeydanı Hastane","m":[["Metrobüs",34]]},{"n":"Saadetdere Mahallesi","m":[["Metrobüs",8]]},{"n":"Sefaköy","m":[["Metrobüs",18]]},{"n":"Topkapı","m":[["Metrobüs",26]]},{"n":"Uzunçayır","m":[["Metrobüs",42]]},{"n":"Zeytinburnu","m":[["Metrobüs",23]]},{"n":"Çağlayan","m":[["Metrobüs",35]]},{"n":"İBB Sosyal Tesisler","m":[["Metrobüs",13]]},{"n":"Şükrübey","m":[["Metrobüs",12]]}]};

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
    a: "M11 ve Marmaray süreleri TCDD'nin yayımladığı gerçek tarifeden istasyon istasyon türetilmiştir. Metro ve metrobüs hatlarında istasyon bazlı tarife yayımlanmadığı için hat toplam süresi mesafeye orantılı dağıtılmıştır; bu hatlar sonuçta 'tahmini' olarak işaretlenir." },
  { q: "Aktarma süresi nasıl hesaplanıyor?",
    a: "Aktarma = peronlar arası yürüme (istasyon koordinatları arasındaki mesafeden, 80 m/dk) + ortalama bekleme (hattın sefer aralığının yarısı). Gerçek bekleme 0 ile sefer aralığı arasında değişir." },
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
    <div class="opts" id="opts"></div>
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
  function search(srcNodes, dstSet, penalty){
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
  function schedule(legs, t0){
    var t = t0, out = [], cost = 0, ogr = 0, sos = 0, flatSeq = 0, est = false;
    legs.forEach(function(g, k){
      var N = L[g.ln];
      if(g.i === g.j) return;
      var wait = Math.round(N.h / 2);
      var walk = 0;
      if(k > 0){
        var prev = legs[k-1];
        for(var q=0;q<X.length;q++){
          var x = X[q];
          if((x[0]===prev.ln && x[2]===g.ln) || (x[2]===prev.ln && x[0]===g.ln)){ walk = x[4]; break; }
        }
      }
      var dep = t + walk + wait;
      var ride = Math.abs(N.t[g.j] - N.t[g.i]);
      var arr = dep + ride;
      var stops = Math.abs(g.j - g.i);
      var f;
      if(N.fare){ var F = fareDist(g.ln, stops); f = { tam: F[1], ogr: F[2], sos: F[3] }; flatSeq = 0; }
      else { var s = Math.min(flatSeq, FLAT.length - 1); f = FLAT[s]; flatSeq++; }
      cost += f.tam; ogr += f.ogr; sos += f.sos;
      if(N.k !== "tcdd") est = true;
      out.push({ ln: g.ln, from: N.n[g.i], to: N.n[g.j], dep: dep, arr: arr, ride: ride,
                 stops: stops, walk: walk, wait: wait, fare: f.tam, est: N.k !== "tcdd" });
      t = arr;
    });
    return { legs: out, t0: t0, arr: t, total: t - t0, cost: cost, ogr: ogr, sos: sos, est: est };
  }

  function render(plan, badge, cls){
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
    return '<div class="opt ' + cls + '"><div class="opt-head">' +
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

    var fast = search(src, dstSet, function(){ return 5; });        // hızlı: aktarma cezası düşük
    var few  = search(src, dstSet, function(){ return 25; });       // az aktarmalı
    var pf = fast ? schedule(toLegs(fast), t0) : null;
    var pl = few  ? schedule(toLegs(few),  t0) : null;
    var html = "";
    if(pf) html += render(pf, "En hızlı", "best");
    if(pl && pf && (pl.legs.length !== pf.legs.length || pl.total !== pf.total))
      html += render(pl, pl.legs.length < pf.legs.length ? "Daha az aktarma" : "Alternatif", "alt");
    optsEl.innerHTML = html || "<p class=\\"note\\">Rota bulunamadı.</p>";
    noteEl.innerHTML = (pf && pf.est
      ? "Metro ve metrobüs süreleri <b>tahminidir</b> (istasyon bazlı tarife yayımlanmıyor); M11 ve Marmaray gerçek tarifeden gelir. "
      : "Süreler TCDD tarifesinden. ") +
      "Bekleme, sefer aralığının yarısı olarak alınır. Mesafe bazlı hatlarda (M11, Marmaray, Metrobüs) aktarma indirimi uygulanmaz.";
  }

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
