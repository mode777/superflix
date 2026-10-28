import { Link } from 'react-router-dom';
import { AmbientBackground } from '@/components/media/AmbientBackground';
import { EmptyState } from '@/components/EmptyState';

export default function NotFoundView() {
  return (
    <>
      <AmbientBackground />
      <main className="mx-auto max-w-page px-margin-mobile pb-24 pt-32 md:px-margin-desktop">
        <EmptyState
          icon="explore_off"
          title="Page not found"
          description="The page you are looking for does not exist in this catalog."
          action={
            <Link
              to="/"
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-body-md font-semibold text-on-primary"
            >
              Back to browse
            </Link>
          }
        />
      </main>
    </>
  );
}
