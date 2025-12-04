"use client";

import Navbar from "@/components/protected/navbar";

export default function Page() {
  return (
    <div>
      <Navbar />
      <div className="bg-[#f3f3f3] w-full h-[10rem] px-[4rem] py-10">
        <h1 className=" font-black text-4xl">Product Search</h1>
      </div>
      <div className="flex justify-items-center mt-6">
        <div className="p-3 bg-[#f3f3f3] rounded-lg text-muted-foreground">
          <span>Brand</span>
        </div>
      </div>
    </div>
  );
}
