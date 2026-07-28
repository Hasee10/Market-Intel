'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/market-intel/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), companyName: companyName.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join waitlist.');
      setSubmitted(true);
    } catch (err) {
      toast({
        title: 'Failed to join waitlist',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
        className: 'bg-destructive border border-red-600 shadow-md',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 text-sm dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-400">
        <CheckCircle className="h-4 w-4 shrink-0" />
        You&apos;re on the list - we&apos;ll email you when Market Intel is ready.
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
      <Input
        className="sm:max-w-xs"
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        required
        type="email"
        value={email}
      />
      <Input
        className="sm:max-w-xs"
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="Company (optional)"
        value={companyName}
      />
      <Button disabled={isSubmitting || !email.trim()} type="submit">
        {isSubmitting ? 'Joining…' : 'Get started'}
      </Button>
    </form>
  );
}
