import React from "react";

type Card = {
  id: string;
  bank: string;
  brand: "mastercard" | "visa" | string;
  last4: string;
};

const fakeCards: Card[] = [
  { id: "c1", bank: "Yapı Kredi Bankası", brand: "mastercard", last4: "8554" },
  { id: "c2", bank: "Yapı Kredi Bankası", brand: "mastercard", last4: "9979" },
];

function BrandIcon({ brand }: { brand: string }) {
  if (brand === "mastercard") {
    return (
      <div className="flex items-center gap-1">
        <span className="w-6 h-6 rounded-full bg-linear-to-r from-orange-400 to-red-500 inline-block -ml-1"></span>
        <span className="w-6 h-6 rounded-full bg-yellow-300 inline-block -ml-3"></span>
      </div>
    );
  }

  return <div className="w-8 h-6 bg-slate-200 rounded" />;
}

export default function Page() {
  return (
    <div className="py-8">
      <div className="container">
        <h1 className="text-2xl font-semibold mb-6">Payment Methods</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fakeCards.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-slate-500">{c.bank}</div>
                  <div className="mt-3 flex items-center gap-4">
                    <BrandIcon brand={c.brand} />
                    <div>
                      <div className="text-sm text-slate-400">
                        Card ending in **** {c.last4}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit link hidden per request */}
              </div>

              <div className="mt-6 flex items-center justify-end"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
