"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { TrashBook } from "../../lib/archive/types";
import { BOOK_TITLE_FONT } from "../../lib/archive/utils";
import BookCover from "./BookCover";

export default function TrashModal({
  isTrashOpen, isAdmin, trashedBooks, trashError, isTrashLoading,
  trashBusyId, onClose, onRestore, onDeleteForever, onRefresh,
}: {
  isTrashOpen: boolean;
  isAdmin: boolean;
  trashedBooks: TrashBook[];
  trashError: string;
  isTrashLoading: boolean;
  trashBusyId: string | null;
  onClose: () => void;
  onRestore: (book: TrashBook) => Promise<void>;
  onDeleteForever: (book: TrashBook) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  return (
      <AnimatePresence>
        {isTrashOpen && isAdmin && (
          <motion.div
            key="trash"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#24231f]/45 p-0 backdrop-blur-[5px] sm:p-7"
            onMouseDown={(event) => { if (event.target === event.currentTarget && !trashBusyId) onClose(); }}
          >
            <motion.section
              role="dialog" aria-modal="true" aria-label="독서 아카이브 휴지통"
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              className="h-[100dvh] max-h-[100dvh] w-full max-w-[800px] overflow-y-auto overscroll-contain bg-white p-5 text-[#1A1A18] shadow-[0_24px_90px_rgba(0,0,0,.18)] sm:h-auto sm:max-h-[90vh] sm:p-12"
            >
              <div className="mb-8 flex items-start justify-between gap-5 border-b border-black/15 pb-7">
                <div>
                  <p className="mb-4 font-sans text-[10px] font-semibold tracking-[0.23em] text-[#6B665E]">PRIVATE ARCHIVE / ADMIN ONLY</p>
                  <h2 className="text-4xl font-normal tracking-[-0.07em] sm:text-5xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>Trash<span className="italic">.</span></h2>
                  <p className="mt-4 font-sans text-[12px] leading-5 text-[#77746c]">삭제한 책과 독서 기록은 직접 영구 삭제하기 전까지 보관됩니다.</p>
                </div>
                <button type="button" onClick={() => onClose()} disabled={Boolean(trashBusyId)} className="flex min-h-11 min-w-11 items-center justify-center text-2xl text-[#6B665E] hover:text-black disabled:opacity-30" aria-label="휴지통 닫기">×</button>
              </div>

              {trashError && <p role="alert" className="mb-6 font-sans text-xs leading-6 text-red-800">{trashError}</p>}
              {isTrashLoading ? (
                <p className="py-16 text-center font-sans text-[11px] tracking-[0.18em] text-[#6B665E]">LOADING TRASH...</p>
              ) : trashedBooks.length === 0 && !trashError ? (
                <div className="py-16 text-center">
                  <p className="mb-3 font-sans text-[11px] tracking-[0.18em] text-[#6B665E]">TRASH IS EMPTY</p>
                  <p className="text-sm" style={{ fontFamily: BOOK_TITLE_FONT }}>휴지통이 비어 있어요.</p>
                </div>
              ) : (
                <div className="divide-y divide-black/10">
                  {trashedBooks.map((book) => (
                    <div key={book.id} className="flex items-center gap-4 py-5 sm:gap-6">
                      <BookCover book={book} className="aspect-[2/3] w-[56px] shrink-0 shadow-sm sm:w-[70px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] text-[#262520]" style={{ fontFamily: BOOK_TITLE_FONT }}>{book.title}</p>
                        <p className="mt-1 truncate font-sans text-[11px] text-[#6B665E]">{book.author}</p>
                        <p className="mt-2 font-sans text-[11px] text-[#6B665E]">
                          {book.trashedAt ? `삭제일 ${new Date(book.trashedAt).toLocaleDateString("ko-KR")}` : "휴지통 보관 중"}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 font-sans text-[11px] font-semibold tracking-[0.12em]">
                          <button type="button" disabled={Boolean(trashBusyId)} onClick={() => void onRestore(book)} className="border-b border-black/50 pb-1 transition-opacity hover:opacity-50 disabled:opacity-30">RESTORE ↗</button>
                          <button type="button" disabled={Boolean(trashBusyId)} onClick={() => void onDeleteForever(book)} className="border-b border-red-800/40 pb-1 text-red-900 transition-opacity hover:opacity-50 disabled:opacity-30">DELETE FOREVER</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-8 flex justify-end border-t border-black/10 pt-6">
                <button type="button" disabled={Boolean(trashBusyId)} onClick={() => void onRefresh()} className="font-sans text-[11px] font-semibold tracking-[0.12em] text-[#77756F] transition-opacity hover:opacity-45 disabled:opacity-30">REFRESH ↗</button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

  );
}
