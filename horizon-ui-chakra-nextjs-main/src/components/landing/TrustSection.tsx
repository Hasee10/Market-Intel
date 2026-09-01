'use client';

import { MdVisibilityOff, MdOutlineFilterAlt, MdLock } from 'react-icons/md';

import { Reveal } from 'components/reactbits/Reveal';
import { GlowCard } from '@/components/landing/GlowCard';
import { SectionTitle } from '@/components/landing/SectionTitle';

// Same wording as the "Peer benchmarking, not surveillance" alert on the
// actual Market page (dashboard/market/MarketView.tsx) - the landing page
// promise and the in-product behavior should say the same thing, not two
// different stories.
const POINTS = [
  {
    icon: MdVisibilityOff,
    title: 'Aggregate or opt-in only',
    description:
      'You only ever see anonymized, aggregate benchmarks - or fields a peer has explicitly chosen to share, like rating or price position.',
  },
  {
    icon: MdOutlineFilterAlt,
    title: 'A sample-size floor',
    description:
      "Benchmarks don't compute at all until enough sellers share a category, so no single competitor's numbers can be reverse-engineered.",
  },
  {
    icon: MdLock,
    title: 'Your private data stays private',
    description:
      'Your own orders, customers, and churn numbers are never visible to another seller - full stop, no setting can change that.',
  },
];

// Node geometry, shared by the circle and the connector maths below. The
// connector has to stop exactly at the node's edge, so these can't drift
// apart - hence one constant instead of the number written twice.
const NODE_PX = 56; // size-14
const NODE_RADIUS = NODE_PX / 2;
const CONNECTOR_CLEARANCE = NODE_RADIUS + 6; // 6px of air before the circle
const COLUMN_GAP_PX = 24; // md:gap-x-6

// Rendered as one connected pipeline rather than three separate cards: these
// three guarantees are sequential in the data path (aggregate -> gate on
// sample size -> nothing private ever leaves), so a chain says something the
// old loose grid didn't.
//
// Deliberately NOT numbered. Numbering would promise a procedure the reader
// can step through, and these are properties of the system, not steps a
// seller performs. The arrows carry direction; digits would overclaim.
//
// The icons moved out of the cards and onto the chain itself. Keeping them
// inside meant each connector had to line up with an icon buried under a
// card's border plus padding, which breaks the moment either changes. On a
// rail the nodes are the only thing the connector has to find.
export function TrustSection() {
  return (
    <section className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white">
      <SectionTitle
        title="Peer benchmarking, not surveillance"
        desc="Nothing private about a competitor's business is ever shown - here's exactly how that works."
      />

      {/* list-none is required, not cosmetic: this stylesheet deliberately
          skips Tailwind's preflight (see styles/tailwind.css), so a bare
          <ol> keeps its default numbering and renders "1." beside each
          node. */}
      <ol className="grid w-full max-w-6xl list-none grid-cols-1 gap-y-12 md:grid-cols-3 md:gap-x-6 md:gap-y-0">
        {POINTS.map((point, i) => {
          const Icon = point.icon;
          return (
            <li key={point.title} className="flex flex-col items-center">
              {/* Inside the Reveal, not beside it: as a sibling the connector
                  was already on screen while its node was still waiting out
                  the stagger, so the section flashed arrows pointing at
                  nothing. In here each link fades in one beat after the node
                  it comes from, and the chain draws itself left to right. */}
              <Reveal delay={i * 120} h="100%" className="relative flex w-full flex-col items-center">
                {i > 0 && <Connector />}

                {/* shrink-0 is load-bearing: this is a flex item in a column
                    that also holds a growing card, and without it the node
                    was squashed from 56px to 41px - which silently moved its
                    centre out from under the connector's fixed offset. */}
                <span
                  aria-hidden="true"
                  className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-[#5044E5] shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-[#A594FF]"
                >
                  <Icon className="size-6" />
                </span>

                {/* grow, not h-full: h-full resolves against a container whose
                    own height comes from its content, so the card demanded
                    100% of a number it was itself defining. grow just takes
                    the space left over, which is what makes the three cards
                    end level. */}
                <GlowCard className="mt-5 w-full grow">
                  <h3 className="text-center font-bold">{point.title}</h3>
                  <p className="mt-2 text-center text-sm text-gray-600 dark:text-white/75">
                    {point.description}
                  </p>
                </GlowCard>
              </Reveal>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// Draws the link from the previous node to this one. Both offsets are
// percentages of this grid cell, which is what makes the maths tractable:
// cells are equal width, so the previous node's centre is always exactly one
// cell plus one gap to the left of this one's.
function Connector() {
  return (
    <>
      {/* Stacked layout: the chain runs downward through the row gap. */}
      <span
        aria-hidden="true"
        className="chain-line-y absolute -top-12 left-1/2 h-12 w-px -translate-x-1/2 text-gray-300 md:hidden dark:text-gray-600"
      />

      {/* Side-by-side layout: horizontal, node edge to node edge. */}
      <span
        aria-hidden="true"
        style={{
          top: NODE_RADIUS - 1,
          left: `calc(-50% - ${COLUMN_GAP_PX}px + ${CONNECTOR_CLEARANCE}px)`,
          right: `calc(50% + ${CONNECTOR_CLEARANCE}px)`,
        }}
        className="chain-line absolute hidden h-px text-gray-300 md:block dark:text-gray-600"
      />

      {/* Arrowhead, so the chain reads as flow rather than as a rule between
          two circles. A rotated corner rather than an SVG: it inherits
          currentColor and stays crisp at any zoom. */}
      <span
        aria-hidden="true"
        style={{ top: NODE_RADIUS - 1, right: `calc(50% + ${CONNECTOR_CLEARANCE}px)` }}
        className="absolute hidden size-1.5 -translate-y-1/2 rotate-45 border-t border-r border-gray-400 md:block dark:border-gray-500"
      />
    </>
  );
}

export default TrustSection;
