import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import SessionGuard from "@/components/SessionGuard";
import SessionRefresher from "@/components/SessionRefresher";

interface Props {
  children: React.ReactNode;
}

export default function layout({ children }: Props) {
  return (
    <main className="h-full flex flex-col">
      <SessionGuard />
      <SessionRefresher />
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </main>
  );
}
