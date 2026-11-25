# BAŞLA — Charmlet projesi (M1 tamamlandı)

M1'i Claude yaptı: prototip gerçek bir proje yapısına taşındı (TypeScript + Vite), kurallar ayrı modülde ve 11 otomatik testle korunuyor.

## Bilgisayarda çalıştırma (Antigravity)
1. Bu klasörü örneğin `C:\Users\<sen>\projeler\charm` içine çıkar.
2. Antigravity'de **File > Open Folder** ile `charm` klasörünü aç.
3. Antigravity'de terminal aç (**Terminal > New Terminal**) ve sırayla yaz:
   - `npm install`  (ilk seferde, 1-2 dakika)
   - `npm test`     (11 testin hepsi "passed" olmalı)
   - `npm run dev`
4. Terminalde **Network: http://192.168.x.x:5173/** gibi bir adres çıkar. iPhone'un aynı Wi-Fi'deyken Safari'de bu adresi aç: oyun telefonunda açılır. Kodda bir şey değişince telefonda kendiliğinden yenilenir.
   - Açılmazsa: Windows "güvenlik duvarı" sorarsa **İzin ver**'e bas.

Node.js kurulu değilse: nodejs.org > LTS sürümünü indir ve kur, sonra Antigravity'yi kapatıp aç.

## Sonraki iş: M2
ROADMAP.md içindeki **M2** promptunu Antigravity'nin ajan paneline yapıştır. Bitince telefonda dene. Takılırsan ekran görüntüsünü Claude'a gönder.

## Klasörde ne var?
- **GDD.md** oyun belgesi · **AGENTS.md** ajan kuralları · **DECISION.md** devam/iptal eşikleri · **ROADMAP.md** aşamalar ve promptlar
- **src/** oyunun kodu (core = kurallar, render = çizim, input = dokunma, feedback = ses/titreşim)
- **tests/** kural testleri · **levels/** seviyeler (sadece `tools/gen.js` ile üretilir) · **prototype/** ilk prototip


## Haftalık otomatik bölümler (GitHub kurulumu, bir kez)
Oyunda 1000 bölüm hazır geliyor. Her pazartesi GitHub kendiliğinden 50 yeni bölüm üretir, hepsini testlerle doğrular ve internete koyar. Oyun açılınca yeni bölümleri indirir, her birini kendisi de çözerek kontrol eder, sonra ekler. Uygulama güncellemesi gerekmez.
1. github.com'da hesap aç ve **charm** adında bir depo (repository) oluştur.
2. Antigravity'ye: "Bu projeyi GitHub'daki charm depoma gönder (git remote add origin … ; git push -u origin main)".
3. GitHub'da depo → Settings → Pages → Source: **GitHub Actions** seç.
4. Actions sekmesinde "Publish site" çalışınca site açılır: https://boyz-ai.github.io/charmlet/
   - Gizlilik sayfası: https://boyz-ai.github.io/charmlet/privacy.html (mağaza bu adresi ister)
   - Bölüm paketleri: https://boyz-ai.github.io/charmlet/packs/
5. Telefon uygulamasını derlerken VITE_PACKS_URL=https://boyz-ai.github.io/charmlet/packs/ verilir (M6'da Claude ayarlar).
6. Elle ek paket: Actions → "Weekly level pack" → Run workflow.
7. Destek e-postası: boyz.destek@gmail.com (public/privacy.html içinde).
