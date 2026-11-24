# BAŞLA — Charm Çözücü projesi (M1 tamamlandı)

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
