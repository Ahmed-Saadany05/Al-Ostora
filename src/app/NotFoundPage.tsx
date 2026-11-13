import { Button, EmptyState, Page } from '@/shared/ui';

export function NotFoundPage() {
  return (
    <Page width="narrow">
      <EmptyState
        icon="moon"
        title="This crater is empty"
        message="The page you're looking for isn't here. It may have drifted into a permanently shadowed region."
        action={
          <Button variant="primary" to="/">
            Back to Explore
          </Button>
        }
      />
    </Page>
  );
}
