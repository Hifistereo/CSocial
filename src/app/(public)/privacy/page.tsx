import Link from "next/link";

export const metadata = { title: "Privacy — CSocial" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">
        Privacy notice — in plain language
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        CSocial is a parent-controlled video app for children. Because it is
        used by kids, we collect as little as possible and explain it simply.
      </p>

      <section className="mt-8 space-y-6 text-slate-700">
        <div>
          <h2 className="font-semibold text-slate-900">What we store about you (the parent)</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
            <li>Your email address and a securely hashed password (and PIN, if you set one).</li>
            <li>The videos you add and your approve/reject decisions.</li>
            <li>
              An audit log of account actions (who approved what, when) so you
              can always see what changed.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900">What we store about your child</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
            <li>
              Only a nickname and an age group — no real name, no email, no
              phone number, no photo.
            </li>
            <li>
              Which approved videos they watched, saved, or reacted to, so you
              can see it on your Activity page.
            </li>
            <li>
              Watch history is automatically deleted after your chosen
              retention period (90 days by default — adjustable in Settings).
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900">What we never do</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
            <li>No ads, no selling data, no engagement-maximising algorithms.</li>
            <li>No location, contacts, camera, or microphone access.</li>
            <li>No public profiles, comments, messaging, or contact with strangers.</li>
            <li>
              We never upload or host the videos themselves — playback uses
              YouTube&apos;s privacy-enhanced player (youtube-nocookie.com),
              which limits YouTube&apos;s tracking. YouTube&apos;s own privacy
              policy applies to playback.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900">Deleting your data</h2>
          <p className="mt-2 text-sm">
            Settings → Delete account removes your account, all child
            profiles, the video library, watch history, and audit logs —
            immediately and permanently.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900">Questions?</h2>
          <p className="mt-2 text-sm">
            This is a small pilot. Contact the family who invited you, or the
            address in your invitation email.
          </p>
        </div>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/login" className="font-semibold text-indigo-600">
          ← Back to sign in
        </Link>
      </p>
    </main>
  );
}
