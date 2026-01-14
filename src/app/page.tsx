/* eslint-disable @typescript-eslint/no-explicit-any */
import Navbar from "@/components/navbar";
import HeaderCarousel from "@/components/header-carousel";
import MiniPaginationGroup from "@/components/mini-pagination-group";
import Footer from "@/components/footer";
import Image from "next/image";
import CountUp from "@/components/count-up";
import InstagramStories from "@/components/instagram-stories";
import { connectDB } from "@/lib/mongoose/instance";
import Collection from "@/schemas/mongoose/collection";

export default async function Page() {
  // fetch all collections (server-side) and render a section per collection
  async function fetchAllCollections() {
    try {
      await connectDB();
      const results = await Collection.find({}).sort({ createdAt: -1 }).lean();
      return Array.isArray(results) ? results : [];
    } catch (e) {
      console.error("fetchAllCollections error:", e);
      return [];
    }
  }

  const collections = await fetchAllCollections();

  return (
    <>
      <main className="h-full flex flex-col">
        <Navbar />
        {/* full-width header carousel */}
        <div className="p-4 md:px-20 lg:px-53">
          <HeaderCarousel />
        </div>
        {/* main content */}
        <div className="flex-1 flex bg-[#f3f3f3] flex-col gap-4 items-center w-full px-4 md:px-10 lg:px-20">
          <div className="w-full my-12 max-w-screen-2xl">
            {collections &&
              collections.length > 0 &&
              collections.map((c: any) => (
                <MiniPaginationGroup
                  key={String(c.shopifyId ?? c._id ?? c.raw?.handle)}
                  title={c?.raw?.title ?? c?.raw?.name ?? "Collection"}
                  collectionHandle={c?.raw?.handle ?? c?.handle}
                />
              ))}
          </div>
        </div>
        <InstagramStories />
        <section className="w-full bg-white mt-10  py-20">
          <div className="max-w-screen-2xl mx-auto sm:px-27 px-10 grid grid-cols-1 gap-8 items-center justify-center">
            <div className="pr-6 w-full flex flex-col items-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl text-start sm:text-center font-extrabold mb-4">
                Our Power Being Global
              </h2>
              <p className="text-base md:text-lg text-gray-700 font-bold text-start sm:text-center w-full  mb-6">
                We are a manufacturer of steering, suspension, hydraulic and
                forged parts for commercial, agricultural, and construction
                vehicles as well as some other industries. We operate two
                manufacturing facilities in Bursa Turkey, supported by sales and
                marketing offices in Istanbul, Turkey, and warehouse-based sales
                offices in São Paulo, Brazil, and Chicago, USA. We are driven by
                the vision of being a customer-focused, market leading and
                global brand that spring first into the mind all over the world
              </p>

              {/* Read more and promotional video removed per request */}
            </div>

            <div className="sm:pl-6">
              {/* stats grid (icons above, number, label, underline) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {[
                  {
                    id: 1,
                    end: 100,
                    suffix: "+",
                    label: "EXPORT COUNTRIES",
                    icon: "countries.svg",
                  },
                  {
                    id: 2,
                    end: 600,
                    suffix: "+",
                    label: "EMPLOYEES",
                    icon: "employes.svg",
                  },
                  {
                    id: 3,
                    end: 20500,
                    label: "INDOOR PRODUCTION AREA",
                    unit: " m²",
                    icon: "factory.svg",
                  },
                  {
                    id: 4,
                    end: 2400000,
                    suffix: "+",
                    label: "PIECE PRODUCTS",
                    icon: "piece-prod.svg",
                  },
                  {
                    id: 5,
                    end: 250,
                    suffix: "+",
                    label: "WAREHOUSES",
                    icon: "customers.svg",
                  },
                  {
                    id: 6,
                    end: 18000,
                    suffix: "+",
                    label: "PRODUCT",
                    icon: "products.svg",
                  },
                  {
                    id: 7,
                    end: 300,
                    suffix: "+",
                    label: "NEW PRODUCTS/YEAR",
                    icon: "new-pro.svg",
                  },
                  {
                    id: 8,
                    end: 75,
                    suffix: "+",
                    label: "YEARS EXPERIENCED IN PRODUCTION",
                    icon: "star.svg",
                  },
                ].map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex flex-col items-start text-start"
                  >
                    <div className="mb-3">
                      <Image
                        src={`/${s.icon}`}
                        alt={s.label}
                        width={44}
                        height={44}
                        className="object-contain"
                      />
                    </div>

                    <div className="text-2xl md:text-3xl font-bold">
                      {s.unit ? (
                        <span className="whitespace-nowrap">
                          <CountUp
                            end={s.end}
                            duration={800 + idx * 60}
                            delay={idx * 80}
                            decimals={0}
                          />
                          {s.unit}
                        </span>
                      ) : (
                        <CountUp
                          end={s.end}
                          duration={800 + idx * 60}
                          delay={idx * 80}
                          suffix={s.suffix}
                        />
                      )}
                    </div>

                    <div className="text-sm text-gray-500 mt-2">{s.label}</div>

                    <div className="w-40 h-1 bg-secondary mt-4"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* instagram stories */}

        <div className="mt-[5rem]">
          <Footer />
        </div>
      </main>
    </>
  );
}

//about
