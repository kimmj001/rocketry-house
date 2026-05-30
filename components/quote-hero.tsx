"use client";

const quotes = [
  { text: "We will find a way. We always have.", source: "Interstellar", position: "left-[8%] top-[24%] max-w-[34rem]", delay: "0s" },
  { text: "I'm going to have to science the shit out of this.", source: "The Martian", position: "right-[8%] top-[36%] max-w-[38rem] text-right", delay: "2.6s" },
  { text: "Houston, we've had a problem.", source: "Apollo 13", position: "left-[15%] bottom-[28%] max-w-[32rem]", delay: "5.2s" },
  { text: "It's time to go home.", source: "Gravity", position: "right-[18%] bottom-[22%] max-w-[24rem] text-right", delay: "7.8s" },
  { text: "To infinity and beyond.", source: "Toy Story", position: "left-[34%] top-[15%] max-w-[30rem]", delay: "10.4s" }
];

export function QuoteHero() {
  return (
    <section className="stars quote-hero-bg relative flex min-h-[92vh] items-center overflow-hidden px-6 pt-16">
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
      <div className="absolute inset-0 z-10">
        {quotes.map((quote) => (
          <div
            key={quote.text}
            className={`quote-line absolute px-6 ${quote.position}`}
            style={{ animationDelay: quote.delay }}
          >
            <p className="text-xl font-medium leading-tight text-orange-50 md:text-4xl">&ldquo;{quote.text}&rdquo;</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/70 md:text-sm">{quote.source}</p>
          </div>
        ))}
      </div>
      <div className="relative z-20 mx-auto mt-[34vh] w-full max-w-7xl px-6">
        <div className="hero-title">
          <h1 className="text-5xl font-semibold tracking-normal md:text-7xl">Rocketry House</h1>
          <p className="mt-5 max-w-2xl text-xl text-orange-50/76">Build, simulate, fork, and fly what comes next.</p>
        </div>
      </div>
      <style jsx>{`
        .quote-line {
          opacity: 0;
          transform: translate3d(0, 18px, 0) scale(0.985);
          animation: quoteDrift 8.5s ease-in-out forwards;
          text-shadow: 0 0 28px rgba(251, 146, 60, 0.18);
        }

        .hero-title {
          opacity: 0;
          transform: translateY(18px);
          animation: revealTitle 1200ms ease-out 12.8s forwards;
        }

        @keyframes quoteDrift {
          0% {
            opacity: 0;
            transform: translate3d(0, 22px, 0) scale(0.985);
          }
          24% {
            opacity: 0.92;
            transform: translate3d(0, 0, 0) scale(1);
          }
          62% {
            opacity: 0.9;
            transform: translate3d(0, -8px, 0) scale(1.005);
          }
          100% {
            opacity: 0;
            transform: translate3d(0, -34px, 0) scale(1.012);
          }
        }

        @keyframes revealTitle {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .quote-line {
            left: 1rem !important;
            right: 1rem !important;
            max-width: calc(100% - 2rem) !important;
            text-align: left;
          }
        }
      `}</style>
    </section>
  );
}
