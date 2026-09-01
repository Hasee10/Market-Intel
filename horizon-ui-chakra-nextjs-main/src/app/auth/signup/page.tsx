'use client';

import { Suspense } from 'react';

import { AuthSlider } from '@/app/auth/_components/AuthSlider';

// See signin/page.tsx. This route in particular has to keep working as a
// real URL with its query string: referral links are shared externally as
// /auth/signup?ref=CODE (ReferralCard builds them), and the code is read
// from useSearchParams inside SignUpForm.
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <AuthSlider initialMode="signup" />
    </Suspense>
  );
}
