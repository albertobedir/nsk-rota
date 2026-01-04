import Navbar from "@/components/navbar";
import HeaderCarousel from "@/components/header-carousel";
import MiniPaginationGroup from "@/components/mini-pagination-group";
import Footer from "@/components/footer";
import Image from "next/image";
import CountUp from "@/components/count-up";
import InstagramStories from "@/components/instagram-stories";

export default function Page() {
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
            <MiniPaginationGroup title="Best Sellers" />
            <MiniPaginationGroup title="Most Liked" />
            <MiniPaginationGroup title="New Arrivals" />
          </div>
        </div>
        <InstagramStories />
        <section className="w-full bg-white mt-10  py-20">
          <div className="max-w-screen-2xl mx-auto sm:px-27 px-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="pr-6">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4">
                Our Power Being Global
              </h2>
              <p className="text-base md:text-lg text-gray-700 max-w-[64ch] leading-8 mb-6">
                We are a manufacturer of steering, suspension, hydraulic and
                forged parts for commercial, agricultural, and construction
                vehicles as well as some other industries. We have two factories
                located in Bursa (Turkey), as well as sales and marketing
                offices in Istanbul (Turkey), New Jersey (USA), and warehouses
                in São Paulo (Brazil) and Chicago (USA).
              </p>

              <a
                href="#"
                className="inline-flex items-center text-sm text-secondary font-medium hover:underline mb-6"
              >
                Read more
                <span className="ml-2 text-secondary">→</span>
              </a>

              <div className="mt-6 flex items-center gap-4">
                <div className="w-28 h-16 rounded overflow-hidden shadow-sm">
                  <Image
                    src="/cr2.jfif"
                    alt="promo"
                    width={112}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold">Promotional Video</div>
                </div>
              </div>
            </div>

            <div className="sm:pl-6 flex flex-col gap-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="text-3xl md:text-4xl font-bold">
                  <CountUp end={250} duration={700} delay={0} suffix="+" />
                </div>
                <div className="text-sm text-gray-500">CUSTOMERS</div>
              </div>

              <div className="flex items-center justify-between border-b pb-4">
                <div className="text-3xl md:text-4xl font-bold">
                  <CountUp end={600} duration={700} delay={120} suffix="+" />
                </div>
                <div className="text-sm text-gray-500">EMPLOYEES</div>
              </div>

              <div className="flex items-center justify-between border-b pb-4">
                <div className="text-3xl md:text-4xl font-bold">
                  <span className="whitespace-nowrap">
                    <CountUp
                      end={20500}
                      duration={900}
                      delay={240}
                      decimals={0}
                    />
                    &nbsp;m²
                  </span>
                </div>
                <div className="text-sm text-end text-gray-500">
                  INDOOR PRODUCTION AREA
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-3xl md:text-4xl font-bold">
                  <CountUp
                    end={2400000}
                    duration={1100}
                    delay={360}
                    suffix="+"
                  />
                </div>
                <div className="text-sm text-gray-500">PIECE PRODUCTS</div>
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
