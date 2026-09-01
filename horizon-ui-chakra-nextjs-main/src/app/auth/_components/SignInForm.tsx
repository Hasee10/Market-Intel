'use client';

import { useState } from 'react';

import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { PasswordInput } from '@/components/marketintel/PasswordInput';
import { createClient } from '@/lib/supabase/client';
import { PATH_AUTH, PATH_DASHBOARD } from '@/lib/paths';

// Lifted out of app/auth/signin/page.tsx so AuthSlider can hold both forms
// mounted at once and slide between them. The submit path - validation,
// Supabase call, the deliberate "invalid_credentials" handling - is moved
// across unchanged; only the surrounding card and the switch link differ.
//
// Fields are still Chakra. Porting them belongs with the rest of the Chakra
// removal, and doing it in the same change as the animation would put a
// working sign-in flow at risk for no visual gain.
export function SignInForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || PATH_DASHBOARD.default;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\S+@\S+$/.test(email)) {
      setError('Invalid email');
      return;
    }
    if (password.length < 6) {
      setError('Password must include at least 6 characters');
      return;
    }

    try {
      setIsLoading(true);
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        // Supabase deliberately returns the same "Invalid login
        // credentials" message whether the password is wrong OR no account
        // exists for that email - telling people "no account exists" would
        // let anyone enumerate which emails are registered. So the error
        // surfaces both possibilities with a direct path to sign up.
        setError(
          signInError.message.toLowerCase().includes('invalid login credentials')
            ? 'invalid_credentials'
            : signInError.message,
        );
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Sign in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {error === 'invalid_credentials' && (
        <Alert status="error" borderRadius="12px" mb="20px" flexDirection="column" alignItems="flex-start">
          <Flex>
            <AlertIcon />
            <Box>
              <AlertTitle>That email/password combination didn&apos;t work</AlertTitle>
              <AlertDescription>
                Double-check your password, or if you haven&apos;t created an account yet, sign up -
                it only takes a minute.
              </AlertDescription>
            </Box>
          </Flex>
          {/* Switches panels rather than navigating, so a mistyped password
              isn't punished with a full page load. */}
          <Button variant="brand" size="sm" mt="12px" onClick={onSwitch}>
            Create an account instead
          </Button>
        </Alert>
      )}
      {error && error !== 'invalid_credentials' && (
        <Alert status="error" borderRadius="12px" mb="20px">
          <AlertIcon />
          <Box>
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
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
        </FormControl>
        <Flex justify="space-between" align="center" mb="24px">
          <Checkbox>Remember me</Checkbox>
          <Link href={PATH_AUTH.passwordReset}>
            <Text fontSize="sm" color="brand.500" fontWeight="500">
              Forgot password?
            </Text>
          </Link>
        </Flex>
        <Button type="submit" variant="brand" w="100%" isLoading={isLoading}>
          Sign in
        </Button>
      </form>

      {/* Still a real <a href> so it can be opened in a new tab and crawled;
          the click is intercepted to slide instead of navigate. */}
      <Flex justify="center" mt="20px" display={{ base: 'flex', lg: 'none' }}>
        <Link
          href={PATH_AUTH.signup}
          onClick={(e) => {
            e.preventDefault();
            onSwitch();
          }}
        >
          <Text fontSize="sm" color="brand.500" fontWeight="500">
            Do not have an account yet? Create account
          </Text>
        </Link>
      </Flex>
    </>
  );
}

export default SignInForm;
