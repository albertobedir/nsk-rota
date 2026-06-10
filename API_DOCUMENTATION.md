# Shopify Ürün Oluşturma API Dokümantasyonu

## Genel Bakış

Bu API, NSK Rota sisteminizden Shopify'a ürünleri otomatik olarak oluşturmak ve yayımlamak için kullanılır. Ürün bilgileri, varyantlar, stok bilgileri, medya ve metaveriler tamamen yönetilir.

---

## 🔐 Kimlik Doğrulama

Aşağıdaki ortam değişkenleri gereklidir:

```env
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxx
```

**Token Kapsamları:**

- `write_products` - Ürün oluşturma ve düzenleme
- `read_inventory` - Stok bilgilerini okuma
- `write_inventory` - Stok ayarlama
- `read_publications` - Yayın kanallarını listeleme

---

## 📋 Endpoint

### POST /api/shopify/products/create

Yeni bir ürün oluşturur, variant ekler, stok ayarlar ve yayımlar.

**Base URL:** `https://your-domain.com`

---

## 📤 Request

### Headers

```
Content-Type: application/json
```

### Request Body

```json
{
  "RotaNo": "29014564",
  "ProductEn": "V Stay Arm (V-Rod)",
  "Price": "507,23",
  "Weight": {
    "kg": "18,02 kg",
    "lb": "39,73 lb"
  },
  "Oems": [
    {
      "RotaNo": "29014564",
      "OemNo": "90549992",
      "MarkaDescription": "NEWAY/SAF HOLLAND",
      "BrandId": "29025"
    }
  ],
  "Applications": [],
  "Details": [
    {
      "id": 37514,
      "RotaNo": "29014564",
      "Technical": "",
      "Technicalmm": "40",
      "Technicalinch": "1.575\"",
      "HarfKodu": "G1",
      "TechnicalDescription": null
    }
  ],
  "Pairings": [],
  "Components": [],
  "Competiters": [],
  "Brands": [
    {
      "RotaNo": "29014564",
      "BrandDescription": "NEWAY/SAF HOLLAND",
      "Brand1": "29025",
      "BrandClass": "COMMERCIAL VEHICLES (AMERICAN)"
    }
  ],
  "Photos": [
    "https://nskgroup.com.tr/storage/products/29014564.jpg",
    "https://nskgroup.com.tr/storage/products/70.jpg"
  ]
}
```

### Request Body Parametreleri

| Alan           | Tür    | Zorunlu | Açıklama                                        |
| -------------- | ------ | ------- | ----------------------------------------------- |
| `RotaNo`       | string | ✅      | Ürün katalog numarası                           |
| `ProductEn`    | string | ✅      | Ürün adı (İngilizce)                            |
| `Price`        | string | ✅      | Fiyat (virgül ile ondalık ayrım, örn: "507,23") |
| `Weight`       | object | ⚠️      | Ağırlık (kg ve lb)                              |
| `Weight.kg`    | string | ❌      | Kilogram cinsinden ağırlık                      |
| `Weight.lb`    | string | ❌      | Pound cinsinden ağırlık                         |
| `Oems`         | array  | ❌      | OEM eşleşmeleri                                 |
| `Applications` | array  | ❌      | Uygulama alanları                               |
| `Details`      | array  | ❌      | Teknik detaylar (boyutlar, özellikler vb.)      |
| `Pairings`     | array  | ❌      | Eşleştirme bilgileri                            |
| `Components`   | array  | ❌      | Bileşen bilgileri                               |
| `Competiters`  | array  | ❌      | Rakip ürünleri                                  |
| `Brands`       | array  | ⚠️      | Marka bilgileri (en az 1 gerekli)               |
| `Photos`       | array  | ❌      | Ürün görselleri URL'leri                        |

---

## 📥 Response

### Başarılı Response (200 OK)

```json
{
  "ok": true,
  "productId": "gid://shopify/Product/123456789",
  "variantId": "789012",
  "handle": "v-stay-arm-v-rod-29014564"
}
```

### Response Parametreleri

| Alan        | Tür     | Açıklama                                    |
| ----------- | ------- | ------------------------------------------- |
| `ok`        | boolean | İşlem başarı durumu                         |
| `productId` | string  | Oluşturulan Shopify ürün ID'si (GraphQL ID) |
| `variantId` | string  | Oluşturulan variant ID'si                   |
| `handle`    | string  | Ürünün URL slug'ı                           |

### Hata Response (500 Internal Server Error)

```json
{
  "ok": false,
  "error": "Variant ID bulunamadı"
}
```

---

## 🔄 API İş Akışı

1. **Publication ID'leri Getir** → Shopify'daki yayın kanallarını al
2. **Location ID Getir** → İlk fiziksel lokasyonu al
3. **Ürün Oluştur** → GraphQL ile yeni ürün oluştur
4. **Variant Güncelle** → REST ile variant bilgilerini ayarla
5. **Stok Ayarla** → Lokasyon bazında stoku 0 olarak ayarla
6. **Yayımla** → Tüm yayın kanallarında ürünü yayımla

---

## 📊 Metafields (Şoprify Custom Fields)

Aşağıdaki veriler otomatik olarak Shopify Metafields olarak kaydedilir:

| Namespace | Key               | Tip  | Kaynak               |
| --------- | ----------------- | ---- | -------------------- |
| `custom`  | `oem_info`        | JSON | `Oems` array         |
| `custom`  | `technical_info`  | JSON | `Details` array      |
| `custom`  | `competitor_info` | JSON | `Competiters` array  |
| `custom`  | `comp`            | JSON | `Components` array   |
| `custom`  | `applications`    | JSON | `Applications` array |
| `custom`  | `pairings`        | JSON | `Pairings` array     |
| `custom`  | `brand_info`      | JSON | `Brands` array       |

---

## 🏷️ Etiketler (Tags)

Ürüne otomatik olarak aşağıdaki etiketler eklenir:

- Brand Class (örn: "COMMERCIAL VEHICLES (AMERICAN)")
- Tüm marka açıklamaları
- Tüm OEM marka açıklamaları
- Tüm rakip adları

Tekrarlı etiketler otomatik olarak kaldırılır.

---

## 📸 Medya (Görseller)

**Sıralama Kuralları:**

- `products/XXXXX` formatındaki URL'ler (örn: `products/29014564`) ilk sıraya alınır (ana görsel)
- Diğer görseller izleyen sıralara alınır

**Örnek:**

```
1. https://nskgroup.com.tr/storage/products/29014564.jpg (ANA)
2. https://nskgroup.com.tr/storage/products/70.jpg
```

---

## ⚙️ Variant Ayarları

Her ürün için otomatik olarak ayarlanan variant özellikleri:

```
- SKU: RotaNo
- Fiyat: Parsed Price
- Ağırlık: Weight (lb cinsinden)
- Ağırlık Birimi: lb (pound)
- Envanter Yönetimi: "shopify" (Shopify tarafından yönetilir)
- Envanter Politikası: "deny" (Stok bitince satış kapanır)
```

---

## 🚨 Hata Yönetimi

### Yaygın Hatalar

| Hata                    | Sebep                                   | Çözüm                                      |
| ----------------------- | --------------------------------------- | ------------------------------------------ |
| "Variant ID bulunamadı" | Ürün oluştuktan sonra variant alınamadı | Shopify API bağlantısını kontrol edin      |
| "Product ID alınamadı"  | Ürün oluşturma başarısız                | Request body'yi doğrulayın                 |
| Stok ayarlanamadı (⚠️)  | Lokasyon ID eksik                       | Shopify'da en az 1 lokasyon olması gerekli |
| "GraphQL Error"         | GraphQL query'de hata                   | Shopify API versiyonunu kontrol edin       |

### Hata Loglama

Tüm hatalar console'a kaydedilir:

```
❌ Product creation error: [ERROR MESSAGE]
⚠️ Stok ayarlanamadı: [ERROR MESSAGE]
⚠️ Yayımlama hatası: [ERROR MESSAGE]
```

---

## 💡 Örnek cURL Komutu

```bash
curl -X POST https://your-domain.com/api/shopify/products/create \
  -H "Content-Type: application/json" \
  -d '{
    "RotaNo": "29014564",
    "ProductEn": "V Stay Arm (V-Rod)",
    "Price": "507,23",
    "Weight": {
      "kg": "18,02 kg",
      "lb": "39,73 lb"
    },
    "Brands": [
      {
        "RotaNo": "29014564",
        "BrandDescription": "NEWAY/SAF HOLLAND",
        "Brand1": "29025",
        "BrandClass": "COMMERCIAL VEHICLES (AMERICAN)"
      }
    ],
    "Photos": [
      "https://nskgroup.com.tr/storage/products/29014564.jpg"
    ],
    "Oems": [],
    "Applications": [],
    "Details": [],
    "Pairings": [],
    "Components": [],
    "Competiters": []
  }'
```

---

## 🔗 JavaScript/TypeScript Örneği

```typescript
const response = await fetch("/api/shopify/products/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    RotaNo: "29014564",
    ProductEn: "V Stay Arm (V-Rod)",
    Price: "507,23",
    Weight: {
      kg: "18,02 kg",
      lb: "39,73 lb",
    },
    Brands: [
      {
        RotaNo: "29014564",
        BrandDescription: "NEWAY/SAF HOLLAND",
        Brand1: "29025",
        BrandClass: "COMMERCIAL VEHICLES (AMERICAN)",
      },
    ],
    Photos: ["https://nskgroup.com.tr/storage/products/29014564.jpg"],
    Oems: [],
    Applications: [],
    Details: [],
    Pairings: [],
    Components: [],
    Competiters: [],
  }),
});

const data = await response.json();
console.log(data);
```

---

## 📝 Notlar

- **Fiyat Formatı:** Virgül (`,`) kullanılmalı, nokta (`.`) değil (Türk formatı)
- **API Versiyonu:** `2024-10` (Shopify Admin API)
- **Runtime:** Node.js (Edge Runtime değil)
- **Stok:** Varsayılan olarak 0 olarak ayarlanır
- **Durum:** Tüm ürünler `ACTIVE` olarak oluşturulur
- **Yayın:** Ürün otomatik olarak tüm aktif yayın kanallarında yayımlanır

---

## 🔐 Güvenlik Notları

- ✅ Access Token ortam değişkeninde tutulur (hardcode edilmez)
- ✅ GraphQL ve REST endpoints güvenli HTTPS ile iletişim kurar
- ✅ Tüm hatalar server-side'da handled edilir
- ⚠️ Production ortamında rate limiting ekleyini düşünün
- ⚠️ Büyük batch işlemleri için job queue kullanınız

---

## 📞 Destek

Hata veya sorun durumunda:

1. Console loglarını kontrol edin
2. Shopify Admin Panel'de ürünü kontrol edin
3. API access token'ın geçerliliğini doğrulayın
4. Shopify API documentation'ını kontrol edin: https://shopify.dev/api/admin-rest
