'use client';

import { Suspense, useState } from 'react';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { AuthCard } from '@/components/marketintel/AuthCard';
import { PasswordInput } from '@/components/marketintel/PasswordInput';
import { PasswordRequirements } from '@/components/marketintel/PasswordRequirements';
import { createClient } from '@/lib/supabase/client';
import { validatePassword } from '@/lib/password';
import { PATH_AUTH, PATH_DASHBOARD } from '@/lib/paths';

// useSearchParams() (for ?ref=CODE) forces this into a client-side-rendered
// boundary during prerendering - Next.js requires that boundary to be
// wrapped in Suspense, so the form itself lives in SignUpForm below and
// this default export is just that wrapper.
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get('ref');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (businessName.trim().length === 0) {
      setError('Enter your store/business name');
      return;
    }
    if (!/^\S+@\S+$/.test(email)) {
      setError('Invalid email');
      return;
    }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(`Password needs: ${passwordCheck.failedRule}`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // referral_code rides along in the signup metadata rather than
          // going to a separate endpoint: the signup trigger
          // (018_referral_integrity.sql) reads it and records the referral
          // server-side. The endpoint this replaced took a caller-supplied
          // userId and could not be session-gated (no session exists while
          // email confirmation is pending), which made the free->paid
          // referral reward forgeable by anyone - see leaks.md finding #1.
          data: { business_name: businessName, referral_code: referralCode ?? '' },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // Email confirmation is on by default for a new Supabase project -
      // there's no session yet until the seller clicks the confirmation
      // link, so we can't route straight to the dashboard.
      if (!data.session) {
        setConfirmationSent(true);
        return;
      }

      router.push(PATH_DASHBOARD.default);
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Sign up error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Welcome!"
      subtitle="Create your seller account to continue"
      illustrationSrc="/assets/ryvl-signup-illustration.png"
      illustrationAlt="Create your Ryvl seller account"
    >
      {error && (
        <Alert status="error" borderRadius="12px" mb="20px">
          <AlertIcon />
          <Box>
            <AlertTitle>Sign up error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      )}

      {confirmationSent ? (
        <Alert status="success" borderRadius="12px">
          <AlertIcon />
          <Box>
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription>
              We sent a confirmation link to {email}. Click it to activate your account, then
              sign in.
            </AlertDescription>
          </Box>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormControl mb="16px">
            <FormLabel fontSize="sm" fontWeight="500">
              Business / store name
            </FormLabel>
            <Input
              placeholder="e.g. Karachi Coffee Co."
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </FormControl>
          <FormControl mb="16px">
            <FormLabel fontSize="sm" fontWeight="500">
              Email
            </FormLabel>
            <Input
              type="email"
              placeholder="you@yourstore.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormControl>
          <FormControl mb="16px">
            <FormLabel fontSize="sm" fontWeight="500">
              Password
            </FormLabel>
            <PasswordInput
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isRequired
            />
            {password.length > 0 && <PasswordRequirements password={password} />}
          </FormControl>
          <FormControl mb="24px">
            <FormLabel fontSize="sm" fontWeight="500">
              Confirm Password
            </FormLabel>
            <PasswordInput
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              isRequired
            />
          </FormControl>
          <Button type="submit" variant="brand" w="100%" isLoading={isLoading}>
            Create account
          </Button>
        </form>
      )}

      <Flex justify="center" mt="20px">
        <Link href={PATH_AUTH.signin}>
          <Text fontSize="sm" color="brand.500" fontWeight="500">
            Already have an account? Sign in
          </Text>
        </Link>
      </Flex>
    </AuthCard>
  );
}
