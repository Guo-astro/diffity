import { useNavigate } from 'react-router';
import { openPrInbox } from '../palette/quick-open';
import { openPullRequest } from '../open-links/use-open-links';
import { inboxCounts } from './inbox';
import { InboxRow } from './inbox-row';
import { useLocalClones, usePrInbox } from './use-pr-inbox';

const SHOWN = 5;

/** The welcome screen's short list of PRs that need your review; hidden when signed out or when nothing is waiting. */
export function WaitingOnYou() {
  const navigate = useNavigate();
  const inbox = usePrInbox();
  const clones = useLocalClones();

  if (!inbox.signedIn || inbox.items.length === 0) {
    return null;
  }
  const counts = inboxCounts(inbox.items);
  const waiting = inbox.items.filter((item) => item.group === 'review' || item.group === 'team');

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 px-1 mb-1.5 text-xs">
        <h2 className="font-medium text-text-secondary">Waiting on you</h2>
        {waiting.length > 0 && <span className="font-semibold text-accent tabular-nums">{waiting.length}</span>}
        <span className="flex-1" />
        <button onClick={openPrInbox} className="text-accent hover:underline cursor-pointer">
          All pull requests ({counts.all})
        </button>
      </div>
      {waiting.length === 0 ? (
        <p className="px-3 py-4 rounded-lg border border-border bg-bg text-[13px] text-text-secondary text-center">No reviews waiting on you</p>
      ) : (
        <div className="rounded-lg border border-border bg-bg p-1">
          {waiting.slice(0, SHOWN).map((item) => (
            <InboxRow
              key={item.pr.url}
              item={item}
              localPath={clones.get(item.pr.repo.toLowerCase())}
              onOpen={(newWindow) => void openPullRequest(item.pr.url, null, newWindow, navigate)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
