'use client';

import { useState } from 'react';

import { Alert, AlertIcon, Button, Flex, FormControl, FormLabel, Icon, Input, Text } from '@chakra-ui/react';
import { MdChevronLeft } from 'react-icons/md';
import Link from 'next/link';

import { AuthCard } from '@/components/marketintel/AuthCard';
import { createClient } from '@/lib/supabase/client';
import { PATH_AUTH } from '@/lib/paths';

export default function PasswordResetPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Password reset error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard title="Forgot your password?" subtitle="Enter your email to get a reset link">
      {error && (
        <Alert status="error" borderRadius="12px" mb="20px">
          <AlertIcon />
          {error}
        </Alert>
      )}

      {sent ? (
        <Alert status="success" borderRadius="12px">
          <AlertIcon />
          If an account exists for {email}, a reset link has been sent.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormControl mb="24px">
            <FormLabel fontSize="sm" fontWeight="500">
              Your email
            </FormLabel>
            <Input
              type="email"
              placeholder="me@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormControl>
          <Flex justify="space-between" align="center">
            <Link href={PATH_AUTH.signin}>
              <Flex align="center" gap="4px">
                <Icon as={MdChevronLeft} />
                <Text fontSize="sm">Back to the login page</Text>
              </Flex>
            </Link>
            <Button type="submit" variant="brand" isLoading={isLoading}>
              Reset password
            </Button>
          </Flex>
        </form>
      )}
    </AuthCard>
  );
}
