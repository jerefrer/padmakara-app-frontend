import { Redirect } from 'expo-router';

/** Old /subscription/* links (checkout returns, bookmarks) now land on the membership page. */
export default function LegacySubscriptionRedirect() {
  return <Redirect href="/membership" />;
}
