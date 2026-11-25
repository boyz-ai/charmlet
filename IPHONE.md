# iPhone uygulaması: TestFlight'a ilk gönderim (bir kez yapılır)

Oyun iPhone uygulamasına hazır (Capacitor, klasör: `ios/`). Bulutta Codemagic derler ve TestFlight'a yollar.
Paket kimliği (bundle id): **com.mucahitkurkaya.charmlet** · Uygulama adı: **Charmlet**

## 1. Paket kimliğini Apple'a kaydet (developer.apple.com)
Account → Certificates, IDs & Profiles → Identifiers → **+** → App IDs → App →
Description: `Charmlet`, Bundle ID: **Explicit** `com.mucahitkurkaya.charmlet` → Continue → Register.

## 2. App Store Connect'te uygulamayı aç (appstoreconnect.apple.com)
Uygulamalar → **+** → Yeni Uygulama → Platform: iOS, Ad: `Charmlet`, Birincil dil: English (U.S.),
Paket Kimliği: listeden `com.mucahitkurkaya.charmlet`, SKU: `charmlet1`, Kullanıcı erişimi: Tam erişim → Oluştur.
Sonra **Uygulama Bilgileri** sayfasındaki **Apple Kimliği** numarasını (10 haneli sayı) not et.

## 3. API anahtarı oluştur (Codemagic senin adına yükleyebilsin diye)
App Store Connect → Kullanıcılar ve Erişim → **Entegrasyonlar** → App Store Connect API → Takım Anahtarları → **+** →
Ad: `Codemagic`, Erişim: **App Manager** → Oluştur. Sayfadaki **Issuer ID** ve **Key ID**'yi not et,
**API Anahtarını İndir** ile `.p8` dosyasını indir (sadece BİR KEZ indirilebilir, sakla; kimseyle paylaşma).

## 4. Codemagic (codemagic.io)
1. GitHub hesabınla kaydol (Personal account) → **Add application** → GitHub → `charm` deposu → "Other / codemagic.yaml".
2. Team settings → Integrations → **Developer Portal / App Store Connect** → Connect → ad: **Charmlet API**
   (codemagic.yaml'daki adla AYNI olmalı) → Issuer ID, Key ID ve `.p8` dosyasını yükle.
3. Team settings → **Code signing identities** → iOS certificates → **Generate certificate** (App Store) →
   iOS provisioning profiles → **Fetch profiles** → `com.mucahitkurkaya.charmlet` App Store profili.
4. Depodaki `codemagic.yaml` içinde `APP_STORE_APPLE_ID: 0` yerine 2. adımdaki numarayı,
   `KULLANICI_ADI` yerine GitHub kullanıcı adını yaz (Antigravity'ye yaptırabilirsin), GitHub'a gönder.
5. Codemagic'te **Start new build** → workflow: *iPhone → TestFlight*. ~15 dakika sürer.

## 5. TestFlight
App Store Connect → uygulama → TestFlight → **İç Test** grubuna kendini ekle. iPhone'a **TestFlight** uygulamasını kur,
gelen davetle oyunu yükle. İlk derlemede Apple "Export Compliance" sormaz (Info.plist'te ayarlı).

## Reklam kimlikleri (AdMob)
Gerçek kimlikler gelince: `node tools/set-admob.cjs <uygulama ~ kimliği> <ödüllü / kimliği> <geçiş / kimliği>`
Bu komut test reklamlarını kapatır ve `public/app-ads.txt` dosyasını yazar. O zamana kadar her derleme Google'ın
TEST reklamlarını gösterir. Kendi oyununda gerçek reklama asla tıklama.
