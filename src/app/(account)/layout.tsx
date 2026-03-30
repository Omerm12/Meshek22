import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AccountNav } from "@/components/account/AccountNav";
import { Container } from "@/components/ui/Container";
import { createClient } from "@/lib/supabase/server";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main
        className="flex-1 py-8 lg:py-12"
        style={{ backgroundColor: "var(--color-surface)" }}
      >
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 items-start">
            {/* Sidebar */}
            <aside className="lg:col-span-1 lg:sticky lg:top-24">
              <AccountNav />
            </aside>

            {/* Page content */}
            <div className="lg:col-span-3">{children}</div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
