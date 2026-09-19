import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { fetchNavbarCategoryTree } from "@/lib/data/storefront";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categoryTree = await fetchNavbarCategoryTree();

  return (
    <div className="flex min-h-screen flex-col">
      <Header categoryTree={categoryTree} />
      {children}
      <Footer />
    </div>
  );
}
