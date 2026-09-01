'use client';

// The top banner/hero for the dedicated /pricing page - separate from the
// PricingTeaser strip on the homepage, which just links here.
export function PricingPageBanner() {
  return (
    <div className="font-manrope bg-gradient-to-b from-[#F7F8FF] to-white pb-10 pt-16 md:pb-[50px] md:pt-20 dark:from-[#111C4E] dark:to-[#0B1437]">
      <div className="mx-auto max-w-[1200px] px-5 text-center md:px-[30px]">
        <h1 className="text-[32px] font-medium tracking-[-0.02em] text-[#111C4E] md:text-[44px] dark:text-white">
          Simple, honest pricing
        </h1>
        <p className="mx-auto mt-4 max-w-[560px] text-base text-gray-600 md:text-lg dark:text-gray-400">
          Start free on your own store. Unlock peer benchmarking, competitor tracking, and full
          market intelligence as you need them - or earn it free by growing the benchmark pool.
        </p>
      </div>
    </div>
  );
}

export default PricingPageBanner;
