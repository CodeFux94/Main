import { BottomNav } from "@/components/bottom-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] md:pb-10 md:pl-60 md:pr-6 md:max-w-none lg:pr-10">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
      <BottomNav />
    </>
  );
}
