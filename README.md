# SOL MEME TRENCHES

Solana meme coinlerini canlıya yakın tarayan, hacim ivmesini ve doğrulanabilir güvenlik sinyallerini aynı radar ekranında birleştiren Next.js uygulaması.

> Bu uygulama yatırım tavsiyesi değildir. “İzlemeye değer” etiketi güvenli, scam değil veya kesin yükselecek anlamına gelmez.

## Cloud-only mimari

- **Frontend + server routes:** Next.js App Router, TypeScript, Tailwind CSS, Vercel
- **Discovery:** DexScreener public API
- **Security enrichment:** RugCheck ve gerektiğinde Solana RPC
- **Persistence:** Supabase PostgreSQL
- **Scheduler:** Vercel Cron → \`/api/scan\`
- **Client:** 45 saniyelik tablo yenilemesi, responsive terminal arayüzü
- **Secrets:** yalnızca Vercel Environment Variables; GitHub’a secret yazılmaz

Vercel projesinin Root Directory değeri \`app\` olmalıdır.

## Vercel Environment Variables

Preview ve Production ortamlarında aşağıdaki değişkenleri Vercel Project Settings → Environment Variables bölümünden tanımla:

- \`NEXT_PUBLIC_SUPABASE_URL\`
- \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`
- \`SUPABASE_SERVICE_ROLE_KEY\` — yalnızca server route ve cron için; browser’a gönderilmez
- \`CRON_SECRET\` — \`/api/scan\` çağrısını korur
- \`SOLANA_RPC_URL\` — tercihen rate-limit destekli bir mainnet RPC URL’i
- \`RUGCHECK_API_BASE_URL\` — opsiyonel; varsayılan \`https://api.rugcheck.xyz\`

Değerleri repository’ye, commit mesajlarına, client bundle’a veya \`.env\` dosyasına yazma. İsimleri görmek için \`app/.env.example\` dosyası bulunur; dosyada gerçek değer yoktur.

## Supabase kurulumu

1. Supabase SQL Editor’ı aç.
2. \`supabase/schema.sql\` içeriğini çalıştır.
3. \`tokens\`, \`token_snapshots\` ve \`watchlist\` tablolarının oluştuğunu doğrula.
4. Vercel Environment Variables değerlerini ekle.
5. Preview Deployment üzerinde \`/api/scan\` çağrısını ve tabloyu doğrula.

Şema; 5m/1h/6h/24h hacim pencerelerini, LP ve authority alanlarını, güvenlik durumunu, karar etiketini, risk bayraklarını ve snapshot geçmişini saklar.

## Tarama mantığı

Skor ağırlıkları:

| Bileşen | Ağırlık |
| --- | ---: |
| Hacim ivmesi | 30% |
| Likidite kalitesi ve korunması | 20% |
| Unique trader / Buy-Sell USD | 15% |
| Güvenlik kontrolleri | 25% |
| Erken yakalama potansiyeli | 10% |

Eksik veya çelişkili veri güvenli kabul edilmez. DexScreener’ın ilgili pair için USD bazlı buy/sell hacmi veya unique trader verisi dönmediği durumda uygulama alanı **Doğrulanmadı** gösterir ve yeşil karar vermeyi engeller; işlem sayısı unique trader yerine kullanılmaz.

## Deploy akışı

Değişiklikler uzak feature branch üzerinde tutulur:

1. GitHub branch’e commit.
2. Vercel ile Preview Deployment oluştur.
3. Preview üzerinde build, \`/api/scan\`, canlı tablo yenilemesi, filtreler, detay paneli ve watchlist akışını kontrol et.
4. Preview doğrulanınca Production Deployment oluştur veya branch’i production’a promote et.

Local clone, local build veya local environment kurulumu bu proje akışının parçası değildir.
