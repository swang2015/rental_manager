import { redirect } from 'next/navigation';
import { getSessionUser, homePathForUser } from '@/lib/auth/session';

export default async function RootPage() {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  redirect(homePathForUser(user));
}
