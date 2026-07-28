import { redirect } from 'next/navigation';

import { Container, Stack } from '@mantine/core';

import { PageHeader, Surface } from '@/components';
import { getCurrentSeller, getPrimaryDomain, listCategories } from '@/lib/market-intel/seller';
import { PATH_DASHBOARD } from '@/routes';

import { CategoryPicker } from './CategoryPicker';

async function Page() {
  const seller = await getCurrentSeller();

  if (!seller) {
    redirect('/auth/signin');
  }

  const existingDomain = await getPrimaryDomain(seller.id);
  if (existingDomain) {
    redirect(PATH_DASHBOARD.market);
  }

  const categories = await listCategories();

  return (
    <>
      <title>Choose your domain | Market Intel</title>
      <meta
        name="description"
        content="Pick the category that best describes your store so we can benchmark you against the right peers."
      />
      <Container fluid>
        <Stack gap="lg">
          <PageHeader title="Welcome - one quick step" />
          <Surface p="md" style={{ maxWidth: 560 }}>
            <CategoryPicker categories={categories} />
          </Surface>
        </Stack>
      </Container>
    </>
  );
}

export default Page;
