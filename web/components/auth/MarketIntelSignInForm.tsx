'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import config from '@/config';
import { useToast } from '@/hooks/use-toast';
import { resolveColor } from '@/lib/utils/colors';
import { safeInternalRedirect } from '@/lib/utils/safe-redirect';

export function MarketIntelSignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        accountType: 'market_analyst',
        redirect: false,
      });

      if (result?.error) {
        toast({
          title: 'Sign in failed',
          description: 'Invalid email or password.',
          variant: 'destructive',
          className: 'bg-destructive border border-red-600 shadow-md',
        });
        return;
      }

      const callbackUrl = safeInternalRedirect(searchParams.get('callbackUrl'), '/intel/dashboard');
      router.push(callbackUrl);
      router.refresh();
    } catch {
      toast({
        title: 'Sign in failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
        className: 'bg-destructive border border-red-600 shadow-md',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="email">Email</Label>
            <Input
              disabled={isSubmitting}
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-sm" htmlFor="password">Password</Label>
            <PasswordInput
              disabled={isSubmitting}
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              value={password}
            />
          </div>
        </div>

        <Button
          className="w-full"
          disabled={isSubmitting}
          style={{ backgroundColor: resolveColor(config.ui.primaryColor) }}
          type="submit"
          variant="primary"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
