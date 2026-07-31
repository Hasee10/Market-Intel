'use client';

import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Container,
  Heading,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';

// Real answers to real questions about this specific product - not filler.
// This is the honest substitute for customer testimonials while there's no
// public user base yet (see landing page research): answer what visitors
// actually need to decide "is this for me," not vague reassurance copy.
const FAQS = [
  {
    q: 'Which marketplaces do you actually track?',
    a: 'PriceOye, Telemart, Shophive, iShopping, Goto, SapphireOnline, and OLX - covering mobiles/electronics and fashion/apparel today, with more categories being added as scraper coverage expands.',
  },
  {
    q: 'Can other sellers see my orders, customers, or revenue?',
    a: 'No. Your private data never leaves your account. Peer benchmarks are computed as anonymized aggregates with a minimum sample size, and the only per-seller fields ever shown to peers are ones you explicitly opt in to share (like rating or price position) in Settings.',
  },
  {
    q: 'How does the referral plan upgrade actually work?',
    a: 'Every seller gets a unique invite link from Settings. When 3 sellers you referred sign up, your account is automatically upgraded from Free to Paid - no manual approval, no credit card.',
  },
  {
    q: 'How fresh is the competitor pricing data?',
    a: 'The scraper refreshes on a schedule (currently up to every 2 days depending on source), and each category on the Market page shows exactly when it was last scraped, so you always know how current the numbers are.',
  },
  {
    q: 'Is this only for sellers in Pakistan?',
    a: "Today, yes - the 7 tracked marketplaces are all Pakistani e-commerce and classifieds sites. The underlying platform isn't region-locked, so this can expand to other markets as scraper coverage grows.",
  },
  {
    q: 'What happens on the Free plan if I never upgrade?',
    a: "You keep full access to your own store analytics forever - orders, products, customers, churn/retention insights, and bulk CSV import. Peer benchmarks, competitor watchlists, and the premium analytics (forecasting, pricing recommendations) are what's gated, not your own data.",
  },
];

export function FaqSection() {
  const sectionBg = useColorModeValue('white', 'navy.900');
  const kicker = useColorModeValue('#4318FF', '#A594FF');
  const heading = useColorModeValue('#111C4E', 'white');
  const body = useColorModeValue('gray.600', 'secondaryGray.400');
  const itemBorder = useColorModeValue('gray.100', 'whiteAlpha.100');

  return (
    <Box bg={sectionBg} py={{ base: '70px', md: '100px' }}>
      <Container maxW="800px" px={{ base: '20px', md: '30px' }}>
        <Box textAlign="center" mb={{ base: '40px', md: '56px' }}>
          <Text fontSize="xs" fontWeight="700" color={kicker} letterSpacing="0.08em" textTransform="uppercase" mb="12px">
            Questions
          </Text>
          <Heading as="h2" fontSize={{ base: '28px', md: '36px' }} color={heading} letterSpacing="-0.02em">
            Frequently asked questions
          </Heading>
        </Box>

        <Accordion allowToggle>
          {FAQS.map((faq) => (
            <AccordionItem key={faq.q} border="none" borderBottom="1px solid" borderColor={itemBorder} py="8px">
              <AccordionButton px="0" py="16px" _hover={{ bg: 'transparent', color: '#4318FF' }}>
                <Box flex="1" textAlign="left" fontWeight="600" color={heading} fontSize="md">
                  {faq.q}
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel px="0" pb="20px" color={body} fontSize="sm" lineHeight="1.7">
                {faq.a}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </Box>
  );
}

export default FaqSection;
