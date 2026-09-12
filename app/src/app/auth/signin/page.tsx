'use client';

import { Suspense } from 'react';

import { AuthSlider } from '@/app/auth/_components/AuthSlider';

// Both auth routes render the same component with a different starting side
// - see AuthSlider for why switching between them is local state rather than
// a navigation. This stays a real, separately-addressable route: three
// server-side redirect('/auth/signin') calls point here.
//
// Suspense is still required: the forms read useSearchParams (?callbackUrl=
// here, ?ref= on signup), which forces a client-side-rendered boundary
// during prerendering and Next requires that boundary to be wrapped.
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <AuthSlider initialMode="signin" />
    </Suspense>
  );
}
