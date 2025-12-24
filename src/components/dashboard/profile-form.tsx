"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AccountState = {
  ad: string;
  soyad: string;
  email: string;
  numara: string;
  musteriKodu: string;
  teslimatKosullari: string;
  odemeKosullari: string;
  kullaniciAdi: string;
};

export default function ProfileForm() {
  const [account, setAccount] = useState<AccountState>({
    ad: "AHMET",
    soyad: "AKÇA",
    email: "a.akca@rantech.com.tr",
    numara: "",
    musteriKodu: "0200008039",
    teslimatKosullari: "EXW-EXWORKS",
    odemeKosullari: "90 DAYS AFTER INVOICE DATE",
    kullaniciAdi: "a.akca@rantech.com.tr",
  });

  const [pwd, setPwd] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const [saving, setSaving] = useState(false);
  const mismatch =
    pwd.next.length > 0 && pwd.confirm.length > 0 && pwd.next !== pwd.confirm;

  async function onSave() {
    setSaving(true);
    try {
      // burada API'ne bağlayacaksın (fetch/axios)
      await new Promise((r) => setTimeout(r, 500));
      alert("Kaydedildi ✅");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Left: account */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-900">Hesabım</h2>
        <p className="mt-1 text-sm text-slate-500">(*) Gerekli alan</p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ad">Ad *</Label>
            <Input
              id="ad"
              value={account.ad}
              onChange={(e) =>
                setAccount((s) => ({ ...s, ad: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="soyad">Soyad *</Label>
            <Input
              id="soyad"
              value={account.soyad}
              onChange={(e) =>
                setAccount((s) => ({ ...s, soyad: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">E-Posta *</Label>
            <Input
              id="email"
              type="email"
              value={account.email}
              onChange={(e) =>
                setAccount((s) => ({ ...s, email: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="numara">Numara *</Label>
            <Input
              id="numara"
              value={account.numara}
              onChange={(e) =>
                setAccount((s) => ({ ...s, numara: e.target.value }))
              }
              placeholder="+90..."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="musteriKodu">Müşteri Kodu</Label>
            <Input
              id="musteriKodu"
              value={account.musteriKodu}
              onChange={(e) =>
                setAccount((s) => ({ ...s, musteriKodu: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="teslimat">Teslimat Koşulları</Label>
            <Input
              id="teslimat"
              value={account.teslimatKosullari}
              onChange={(e) =>
                setAccount((s) => ({ ...s, teslimatKosullari: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="odeme">Ödeme Koşulları</Label>
            <Input
              id="odeme"
              value={account.odemeKosullari}
              onChange={(e) =>
                setAccount((s) => ({ ...s, odemeKosullari: e.target.value }))
              }
            />
          </div>
        </div>
      </Card>

      {/* Right: password */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-900">Şifre Değiştir</h2>
        <p className="mt-1 text-sm text-slate-500">(**) Gerekli alan</p>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kullaniciAdi">Kullanıcı Adı *</Label>
            <Input
              id="kullaniciAdi"
              value={account.kullaniciAdi}
              onChange={(e) =>
                setAccount((s) => ({ ...s, kullaniciAdi: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="current">Mevcut Şifre **</Label>
            <Input
              id="current"
              type="password"
              value={pwd.current}
              onChange={(e) =>
                setPwd((s) => ({ ...s, current: e.target.value }))
              }
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="next">Yeni Şifre **</Label>
            <Input
              id="next"
              type="password"
              value={pwd.next}
              onChange={(e) => setPwd((s) => ({ ...s, next: e.target.value }))}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Şifreyi Doğrula **</Label>
            <Input
              id="confirm"
              type="password"
              value={pwd.confirm}
              onChange={(e) =>
                setPwd((s) => ({ ...s, confirm: e.target.value }))
              }
              placeholder="••••••••"
            />
            {mismatch && (
              <p className="text-sm text-red-600">Şifreler eşleşmiyor.</p>
            )}
          </div>

          <div className="pt-2">
            <Button
              className="w-full"
              onClick={onSave}
              disabled={saving || mismatch}
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
