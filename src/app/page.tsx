import { redirect } from "next/navigation";

export default function Page() {
  redirect("/auth/login");
}

// import Footer from "@/components/footer";
// import HeaderCarousel from "@/components/header-carousel";
// import Navbar from "@/components/navbar";
// import MiniPaginationGroup from "@/components/mini-pagination-group";

// export default function Home() {
//   return (
//     <main className="h-full flex flex-col">
//       <Navbar />

//       {/* full-width header carousel */}
//       <div className="p-5 px-60">
//         <HeaderCarousel />
//       </div>

//       {/* sections using MiniPaginationGroup */}
//       <div className="flex-1 flex flex-col gap-4 items-center w-full px-40">
//         <MiniPaginationGroup title="Best Sellers" />
//         <MiniPaginationGroup title="Most Liked" />
//         <MiniPaginationGroup title="New Arrivals" />
//       </div>

//       <Footer />
//     </main>
//   );
// }
