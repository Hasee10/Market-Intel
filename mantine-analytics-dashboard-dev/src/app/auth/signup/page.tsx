'use client';

import { useState } from 'react';

import {
  Alert,
  Button,
  Center,
  Paper,
  PasswordInput,
  Text,
  TextInput,
  TextProps,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Surface } from '@/components';
import { createClient } from '@/lib/supabase/client';
import { PATH_AUTH, PATH_DASHBOARD } from '@/routes';

import classes from './page.module.css';

const LINK_PROPS: TextProps = {
  className: classes.link,
};

function Page() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    initialValues: { businessName: '', email: '', password: '', confirmPassword: '' },
    validate: {
      businessName: (value: string) =>
        value.trim().length > 0 ? null : 'Enter your store/business name',
      email: (value: string) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
      password: (value: string) =>
        value.length >= 6 ? null : 'Password must include at least 6 characters',
      confirmPassword: (value: string, values) =>
        value === values.password ? null : 'Passwords do not match',
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { business_name: values.businessName },
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
    <>
      <title>Sign up | Market Intel</title>
      <meta
        name="description"
        content="Create your seller account to start tracking your store's performance against the market."
      />

      <Title ta="center">Welcome!</Title>
      <Text ta="center">Create your seller account to continue</Text>

      <Surface component={Paper} className={classes.card}>
        {error && (
          <Alert icon={<IconAlertCircle size="1rem" />} title="Sign up error" color="red" mb="md">
            {error}
          </Alert>
        )}

        {confirmationSent ? (
          <Alert icon={<IconCheck size="1rem" />} title="Check your email" color="green">
            We sent a confirmation link to {form.values.email}. Click it to activate your
            account, then sign in.
          </Alert>
        ) : (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <TextInput
              label="Business / store name"
              placeholder="e.g. Karachi Coffee Co."
              required
              classNames={{ label: classes.label }}
              {...form.getInputProps('businessName')}
            />
            <TextInput
              label="Email"
              placeholder="you@yourstore.com"
              required
              mt="md"
              classNames={{ label: classes.label }}
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Password"
              placeholder="Your password"
              required
              mt="md"
              classNames={{ label: classes.label }}
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label="Confirm Password"
              placeholder="Confirm password"
              required
              mt="md"
              classNames={{ label: classes.label }}
              {...form.getInputProps('confirmPassword')}
            />
            <Button fullWidth mt="xl" type="submit" loading={isLoading}>
              Create account
            </Button>
          </form>
        )}

        <Center mt="md">
          <Text size="sm" component={Link} href={PATH_AUTH.signin} {...LINK_PROPS}>
            Already have an account? Sign in
          </Text>
        </Center>
      </Surface>
    </>
  );
}

export default Page;
