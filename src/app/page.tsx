import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { AppShell } from '@/components/AppShell';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return <AppShell initialUser={user} />;
}
