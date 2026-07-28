'use client';

import { Suspense, useState } from 'react';

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

import { AuthCard } from '@/components/marketintel/AuthCard';
import { createClient } from '@/lib/supabase/client';
import { PATH_AUTH, PATH_DASHBOARD } from '@/lib/paths';

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
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
    <AuthCard title="Welcome back!" subtitle="Sign in to your account to continue">
      {error && (
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
          <Input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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

      <Flex justify="center" mt="20px">
        <Link href={PATH_AUTH.signup}>
          <Text fontSize="sm" color="brand.500" fontWeight="500">
            Do not have an account yet? Create account
          </Text>
        </Link>
      </Flex>
    </AuthCard>
  );
}
