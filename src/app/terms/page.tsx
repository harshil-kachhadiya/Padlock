import { Card, CardBody, SiteHeader, PageContainer } from "@/components/ui";

export const metadata = {
  title: "Terms of Service — Padlock",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <PageContainer className="max-w-3xl">
        <h1 className="font-serif text-2xl font-bold text-foreground">Terms of Service</h1>
        <p className="mt-1 text-sm text-foreground-muted">Last updated: [DATE]</p>

        <Card className="mt-6">
          <CardBody className="space-y-6 text-sm leading-relaxed text-foreground">
            <section>
              <h2 className="mb-2 text-base font-bold">The zero-knowledge trade-off</h2>
              <p>
                Padlock encrypts your data with a key derived from your master password, entirely
                on your device. We never receive or store that password, which means{" "}
                <strong>we cannot recover it, and we cannot recover your data if you forget it.</strong>{" "}
                By using Padlock, you accept this trade-off in exchange for us never being able to
                read your passwords either.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">Your responsibilities</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Keep your master password safe — it is the only way to decrypt your vault.</li>
                <li>Use Padlock only for content you have the right to store.</li>
                <li>Do not attempt to circumvent, disrupt, or reverse-engineer the service in ways that would compromise other users&apos; data.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">Service &ldquo;as is&rdquo;</h2>
              <p>
                Padlock is provided as-is, without warranty of any kind. We aim for high
                availability and data integrity but cannot guarantee uninterrupted service.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">Account termination</h2>
              <p>
                You may delete your account and all associated data at any time from Settings. We
                may suspend accounts used to violate these terms or applicable law.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">Changes</h2>
              <p>
                We may update these terms as the product changes. Material changes will be
                reflected by an updated date at the top of this page.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold">Contact</h2>
              <p>Questions: [YOUR SUPPORT EMAIL]</p>
            </section>
          </CardBody>
        </Card>
      </PageContainer>
    </div>
  );
}
