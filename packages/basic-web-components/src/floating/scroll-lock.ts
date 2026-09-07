// Shared body scroll-lock for every overlay component (popover, modal,
// menu, context-menu, select, alert-dialog).
//
// Ownership model: each open overlay calls `acquireScrollLock(host)` once and
// `releaseScrollLock(host)` once on close/teardown. Internally a per-document
// owner set tracks holders; the first acquire saves
// `document.documentElement.style.overflow` and sets it to `hidden`, the last
// release restores the saved value. Acquire is idempotent per owner, release
// of a non-owner is a no-op, so overlapping overlays (e.g. dialog + menu)
// keep scroll locked until ALL of them close.

type DocumentLock = {
  owners: Set<object>;
  overflow: string;
};

const documentLocks = new Map<Document, DocumentLock>();

function ownerDocumentOf(owner: object): Document | null {
  if (owner instanceof Node && owner.ownerDocument) return owner.ownerDocument;
  if (typeof document !== "undefined") return document;
  return null;
}

/** Number of current holders for a document (0 when unlocked). */
export function scrollLockCount(owner: object): number {
  const doc = ownerDocumentOf(owner);
  if (!doc) return 0;
  return documentLocks.get(doc)?.owners.size ?? 0;
}

/** Claim the scroll lock for `owner`. Idempotent; first owner hides overflow. */
export function acquireScrollLock(owner: object): void {
  const doc = ownerDocumentOf(owner);
  if (!doc) return;
  let lock = documentLocks.get(doc);
  if (!lock) {
    lock = { owners: new Set(), overflow: doc.documentElement.style.overflow };
    doc.documentElement.style.overflow = "hidden";
    documentLocks.set(doc, lock);
  }
  lock.owners.add(owner);
}

/** Release `owner`'s claim. Restores overflow when the last owner leaves. */
export function releaseScrollLock(owner: object): void {
  const doc = ownerDocumentOf(owner);
  if (!doc) return;
  // The owner may live in a different document than the one holding its
  // claim (adopted nodes, multi-document tests): scan all known locks.
  const lock = documentLocks.get(doc);
  if (lock && lock.owners.delete(owner)) {
    if (lock.owners.size === 0) {
      try {
        doc.documentElement.style.overflow = lock.overflow;
      } finally {
        documentLocks.delete(doc);
      }
    }
    return;
  }
  for (const [otherDoc, otherLock] of documentLocks) {
    if (otherDoc !== doc && otherLock.owners.delete(owner) && otherLock.owners.size === 0) {
      try {
        otherDoc.documentElement.style.overflow = otherLock.overflow;
      } finally {
        documentLocks.delete(otherDoc);
      }
      return;
    }
  }
}
