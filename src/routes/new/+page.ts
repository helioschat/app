import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
  const query = url.searchParams.get('q');

  if (!query) {
    // If no query parameter, redirect to home
    throw redirect(302, '/');
  }

  // Parse additional query parameters
  const webSearch = url.searchParams.get('webSearch') === 'true';

  // Pass the parameters to the page component
  return {
    query: decodeURIComponent(query),
    webSearchEnabled: webSearch,
  };
};
