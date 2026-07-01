import { Redirect } from 'expo-router';

/** Root URL `/` — main UI lives under the `tabs` group (`app/tabs/index.tsx`). */
export default function Index() {
  return <Redirect href="/tabs" />;
}
