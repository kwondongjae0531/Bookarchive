"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import type { Book } from "../../lib/archive/types";
import { BOOK_TITLE_FONT, getReadingProgress } from "../../lib/archive/utils";
import BookCover from "./BookCover";
import ReadingProgressPanel from "./ReadingProgressPanel";

export default function BookDetail({
  selectedBook, sortedBooks, selectionSource, prefersReducedMotion,
  isAdmin, onClose, onEdit, onDelete, onSaved,
}: {
  selectedBook: Book | null;
  sortedBooks: Book[];
  selectionSource: "shelf" | "index";
  prefersReducedMotion: boolean | null;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book, event?: MouseEvent<HTMLButtonElement>) => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  // 책 상세 창이 열리면 포커스를 창 안으로 이동하고 닫을 때 원래 책으로 돌립니다.
  useEffect(() => {
    if (!selectedBook) return;
    lastTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus({ preventScroll: true });

    return () => {
      const trigger = lastTriggerRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      lastTriggerRef.current = null;
    };
  }, [selectedBook?.id]);

  function keepFocusInside(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
      <AnimatePresence>
        {selectedBook && (
          <motion.div
            key="detail"
            layoutRoot
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1c1b]/40 p-0 backdrop-blur-[6px] sm:p-7"
            onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
          >
            <motion.section
              ref={dialogRef}
              role="dialog" aria-modal="true" aria-labelledby="archive-book-detail-title"
              tabIndex={-1}
              onKeyDown={keepFocusInside}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 22, scale: prefersReducedMotion ? 1 : 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 12, scale: 0.99 }}
              transition={{ duration: prefersReducedMotion ? 0.12 : 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-[100dvh] max-h-[100dvh] w-full max-w-[1080px] overflow-y-auto overscroll-contain border border-[#E2DED6] bg-white text-[#1A1A18] shadow-[0_24px_90px_rgba(0,0,0,.14)] sm:h-auto sm:max-h-[92vh]"
            >
              <button ref={closeButtonRef} type="button" onClick={() => onClose()} className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center bg-white/95 text-[25px] text-[#817e76] transition-colors hover:text-[#1A1A18] sm:right-7 sm:top-6" aria-label="상세 화면 닫기">×</button>
              <div className="grid min-h-[540px] md:grid-cols-[0.9fr_1.1fr]">
                {/* 책이 선반에서 걸어 나와 펼쳐지는 것처럼, 표지를 크게 보여줍니다. */}
                <div className="relative flex items-center justify-center overflow-hidden border-b border-[#E9E5DE] bg-[#F5F3EF] px-8 py-10 sm:px-20 sm:py-20 md:border-b-0 md:border-r md:py-24">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_58%_58%_at_50%_50%,rgba(231,227,219,.45)_0%,rgba(248,248,246,0)_100%)]" />
                  <motion.div
                    key={`detail-cover-${selectedBook.id}`}
                    layoutId={selectionSource === "shelf" && !prefersReducedMotion ? `archive-cover-${selectedBook.id}` : undefined}
                    initial={selectionSource === "shelf" || prefersReducedMotion ? false : { opacity: 0, y: 35, scale: 0.82, rotate: -6 }}
                    animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                    exit={selectionSource === "shelf" ? undefined : { opacity: 0, y: 20, scale: 0.88 }}
                    transition={prefersReducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 220, damping: 28, mass: 0.94 }}
                    className="relative z-10 w-full max-w-[155px] shadow-[9px_22px_34px_rgba(0,0,0,.14)] sm:max-w-[255px]"
                  >
                    <BookCover book={selectedBook} eager className="aspect-[2/3] w-full" />
                  </motion.div>
                  <span className="absolute bottom-7 left-8 font-mono text-[10px] tracking-[0.16em] text-[#6B665E]">PLATE 01 / KWON'S ARCHIVE</span>
                </div>
                <motion.div
                  initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: prefersReducedMotion ? 0 : 10 }}
                  transition={{ duration: prefersReducedMotion ? 0.12 : 0.48, delay: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col justify-center px-6 pb-10 pt-10 sm:px-12 sm:pb-12 sm:pt-16 md:px-16 md:py-20"
                >
                  <div className="mb-9 flex items-center justify-between gap-4 border-b border-[#DCD8D0] pb-5 font-sans text-[10px] uppercase tracking-[0.2em] text-[#6B665E]">
                    <p>003 / READING JOURNAL</p>
                    <p>ENTRY {String(Math.max(1, sortedBooks.findIndex((book) => book.id === selectedBook.id) + 1)).padStart(3, "0")}</p>
                  </div>
                  <h2 id="archive-book-detail-title" className="break-keep text-[clamp(1.85rem,4vw,4rem)] font-normal leading-[1.12] tracking-[-0.065em] sm:text-[clamp(2.15rem,4vw,4rem)]" style={{ fontFamily: BOOK_TITLE_FONT }}>{selectedBook.title}</h2>
                  <p className="mt-5 font-sans text-[12px] tracking-[0.035em] text-[#777168]">{selectedBook.author}</p>
                  <div className="mt-10 grid grid-cols-2 gap-6 border-y border-[#DCD8D0] py-5 font-sans">
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.17em] text-[#6B665E]">READING DATE</p>
                      <p className="text-[11px] tracking-[0.05em] text-[#4C4842]">{selectedBook.date || "—"}</p>
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.17em] text-[#6B665E]">STATUS</p>
                      <p className="text-[11px] tracking-[0.05em] text-[#4C4842]">{selectedBook.status}</p>
                    </div>
                  </div>
                  {selectedBook.status === "읽는 중" && getReadingProgress(selectedBook) && (
                    <ReadingProgressPanel
                      key={selectedBook.id}
                      bookId={selectedBook.id}
                      bookTitle={selectedBook.title}
                      currentPage={getReadingProgress(selectedBook)!.current}
                      totalPages={getReadingProgress(selectedBook)!.total}
                      isAdmin={isAdmin}
                      onSaved={onSaved}
                    />
                  )}
                  {selectedBook.status === "읽는 중" && !getReadingProgress(selectedBook) && isAdmin && (
                    <button type="button" onClick={() => onEdit(selectedBook)} className="mt-7 self-start border-b border-[#A9A39A] pb-1 font-sans text-[11px] tracking-[0.06em] text-[#57534D] hover:text-black">
                      + 독서 진행률 기록하기 ↗
                    </button>
                  )}
                  {selectedBook.quote && (
                    <div className="mt-10">
                      <p className="mb-4 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C8981]">01 / SAVED LINE</p>
                      <blockquote className="border-l-2 border-[#B9B2A7] bg-[#F5F3EF] px-6 py-5 text-[17px] italic leading-[1.95] text-[#4A4842] sm:text-[19px]" style={{ fontFamily: BOOK_TITLE_FONT }}>“{selectedBook.quote}”</blockquote>
                    </div>
                  )}
                  {selectedBook.review && (
                    <div className="mt-10">
                      <p className="mb-4 border-b border-[#E4E0D9] pb-3 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8C8981]">02 / READING NOTES</p>
                      <p className="whitespace-pre-wrap break-words text-[14px] leading-[2] text-[#5F5D57]">{selectedBook.review}</p>
                    </div>
                  )}
                  {!selectedBook.quote && !selectedBook.review && <p className="mt-7 text-xs text-[#6B665E]">아직 저장된 독서 감상이나 문장이 없어요.</p>}
                  {isAdmin && (
                    <div className="mt-12 flex gap-8 border-t border-[#E4E0D9] pt-6 font-sans text-[11px] font-semibold tracking-[0.14em]">
                      <button type="button" onClick={() => onEdit(selectedBook)} className="border-b border-black/50 pb-1">EDIT ↗</button>
                      <button type="button" onClick={(event) => void onDelete(selectedBook, event)} className="border-b border-red-800/45 pb-1 text-red-900">DELETE ↗</button>
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

  );
}
