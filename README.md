# PumpScan — Solana Token Tarayıcı

DexScreener ve RugCheck **public** API'lerini kullanarak Solana tokenlarını
hacim/momentum ve güvenlik kriterlerine göre tarayan, filtreleyen ve listeleyen
bir dashboard. **API key gerektirmez**, tamamen ücretsiz tier'lar ile çalışır.

- **Veri toplama:** Node.js script, GitHub Actions ile **saatlik cron**
- **Veritabanı:** Supabase (PostgreSQL, ücretsiz tier)
- **Frontend:** Next.js (App Router, TypeScript, Tailwind), Vercel'de host

```
.
├── scraper/                # Veri toplama (GitHub Actions üzerinde çalışır)
│   ├── index.js            # Ana akış
│   ├── config.js           # Eşik değerleri + skor ağırlıkları
│   └── lib/                # dexscreener, rugcheck, scoring, supabase, util
├── app/                    # Next.js dashboard (Vercel)
│   ├── app/                # App Router (layout, page, globals)
│   ├── components/         # Dashboard, TokenTable, Filters, Sparkline, ...
│   └── lib/                # supabase client, types, format
├── supabase/
│   └── schema.sql          # Veritabanı şeması + RLS politikaları
└── .github/workflows/
    └── scrape.yml          # Saatlik cron workflow
```

---

## Mimari ve Akış

1. **Scraper** DexScreener'ın `token-boosts`, `token-profiles` ve `search`
   uçlarından Solana aday tokenlarını toplar.
2. Her aday için en likit Solana pair'i çekilir ve eşikler uygulanır
   (likidite ≥ \$5K, 24s hacim ≥ \$10K, yaş ≤ 30 gün — hepsi `config.js`'ten
   ayarlanabilir).
3. Eşiği geçenler için **RugCheck** güvenlik raporu çekilir.
4. **Güvenlik skoru** (LP burned/locked %40 + mint authority null %30 + freeze
   authority null %15 + holder dağılımı %15) ve **momentum skoru** (hacim %40 +
   alış/satış %30 + 1s&6s fiyat %30) hesaplanır.
5. Veriler Supabase `tokens` tablosuna upsert edilir; her tarama
   `token_snapshots`'a zaman serisi kaydı ekler (sparkline için).
6. **Frontend** Supabase'den okur; filtreleme ve sıralama client-side yapılır.

---

## Kurulum

### 1. Supabase Projesi

1. [supabase.com](https://supabase.com) → **New project** (ücretsiz tier).
2. Proje açıldıktan sonra **SQL Editor → New query**, [`supabase/schema.sql`](supabase/schema.sql)
   içeriğini yapıştırıp **Run**. Bu; `tokens` + `token_snapshots` tablolarını,
   indexleri ve RLS politikalarını (yalnızca okuma public) oluşturur.
3. **Settings → API** sayfasından şunları not alın:
   - `Project URL` → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend)
   - `service_role` `secret` key → `SUPABASE_SERVICE_KEY` (yalnızca scraper)

> ⚠️ `service_role` key RLS'i bypass eder. **Asla** frontend'e veya public
> repoya koymayın; sadece GitHub Secrets'ta tutun.

### 2. Scraper'ı Yerelde Test Etme (opsiyonel)

Node.js **18+** gerekir.

```bash
cd scraper
cp .env.example .env        # SUPABASE_URL ve SUPABASE_SERVICE_KEY'i doldurun
npm install
node --env-file=.env index.js   # Node 20.6+ .env'i otomatik yükler
```

> Node 18 kullanıyorsanız `--env-file` yoktur; değişkenleri elle export edin:
> `export SUPABASE_URL=... SUPABASE_SERVICE_KEY=... && npm run scrape`

Ayrıntılı log için `DEBUG=1` ekleyin. Başarılı bir çalışmada Supabase
`tokens` tablosunda satırlar görmelisiniz.

### 3. GitHub Actions (Saatlik Cron)

1. Bu projeyi bir GitHub reposuna push edin.
2. **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
3. [`.github/workflows/scrape.yml`](.github/workflows/scrape.yml) saatlik
   (`0 * * * *`) çalışır. **Actions** sekmesinden **Run workflow** ile manuel
   de tetikleyebilirsiniz (ilk veriyi hemen almak için önerilir).

> Eşik değerlerini kod değiştirmeden ayarlamak için workflow'a `env` olarak
> `MIN_LIQUIDITY_USD`, `MIN_VOLUME_24H`, `MAX_AGE_DAYS`, `MAX_TOKENS_PER_RUN`
> ekleyebilirsiniz (bkz. `scraper/config.js`).

### 4. Frontend'i Vercel'e Deploy Etme

1. [vercel.com](https://vercel.com) → **Add New → Project** → repoyu import edin.
2. **Root Directory** olarak `app` seçin (Next.js bu klasörde).
3. **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy**. Sayfa server component üzerinden Supabase'den okur ve 60sn'de bir
   ISR ile tazelenir.

Yerel geliştirme:

```bash
cd app
cp .env.local.example .env.local   # NEXT_PUBLIC_* değerlerini doldurun
npm install
npm run dev                        # http://localhost:3000
```

---

## Özellikler

- **İki sekme:**
  - **Trend & Güvenli** — güvenlik skoru ≥ 70, momentum'a göre sıralı.
  - **Yüksek Momentum** — tüm tokenlar; güvenlik düşükse satırda ⚠ RİSK rozeti.
- **Sıralama:** her kolon başlığına tıklayarak (tekrar tıkla → yön değişir).
- **Filtreleme:** min. likidite / hacim / güvenlik skoru slider'ları (client-side).
- **Renkli göstergeler:** fiyat değişimi yeşil/kırmızı, güvenlik badge'i
  (yeşil > 70, sarı 40–70, kırmızı < 40).
- **Mini sparkline:** son 24s fiyat trendi (`token_snapshots`'tan, bağımlılıksız SVG).
- **Mobil uyumlu:** küçük ekranda tablo otomatik kart görünümüne döner.
- Header'da **son güncelleme** zamanı.

---

## Ayarlanabilir Eşikler & Skorlar

Tümü [`scraper/config.js`](scraper/config.js) içinde; ortam değişkeniyle de
geçersiz kılınabilir:

| Ayar | Varsayılan | Env |
| --- | --- | --- |
| Min. likidite | \$5.000 | `MIN_LIQUIDITY_USD` |
| Min. 24s hacim | \$10.000 | `MIN_VOLUME_24H` |
| Maks. yaş | 30 gün | `MAX_AGE_DAYS` |
| Tarama başına token | 120 | `MAX_TOKENS_PER_RUN` |

---

## Genişletme

Kod modüler ve yorumludur. İleride ek veri kaynağı (Twitter/Telegram vb.)
eklemek için:

- Yeni bir `scraper/lib/<kaynak>.js` istemcisi yazın.
- `scraper/lib/scoring.js`'e yeni bir bileşen/skor ekleyin.
- `supabase/schema.sql`'e gerekli kolonları ekleyip frontend tiplerini
  (`app/lib/types.ts`) güncelleyin.

---

## Notlar

- Sistem yalnızca **public** endpoint'ler kullandığından API key/ücret gerekmez.
- Scraper'da hata yönetimi token bazlıdır: tek bir token'ın 4xx/5xx hatası
  taramayı durdurmaz, loglanıp atlanır. Ölümcül hatalar (eksik env, Supabase
  yazma hatası) iş akışını başarısız yapar — GitHub Actions loglarından kolayca
  görülür.
- Gösterilen veriler **yatırım tavsiyesi değildir**.
