import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SkipLink } from "@/components/layout/SkipLink";
import { fetchNavbarCategoryTree } from "@/lib/data/storefront";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categoryTree = await fetchNavbarCategoryTree();

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink target="skip-target" />
      <Header categoryTree={categoryTree} />
      <div id="skip-target" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </div>
      <Footer />
    </div>
  );
}
