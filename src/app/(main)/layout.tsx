import Footer from "@/components/footer";
import Navbar from "@/components/navbar";

interface Props {
   children: React.ReactNode;
}

export default function layout({ children }: Props) {
   return (
      <main>
         <Navbar />
         <div>{children}</div>
         <Footer />
      </main>
   );
}
