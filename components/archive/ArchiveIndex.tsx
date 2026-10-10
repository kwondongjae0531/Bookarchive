"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Book, SortBy } from "../../lib/archive/types";
import { BOOK_TITLE_FONT, getReadingProgress, pad } from "../../lib/archive/utils";
import BookCover from "./BookCover";

export default function ArchiveIndex({
  books, completedCount, readingCount, filteredBooks,
  sortBy, setSortBy, isSearchOpen, setIsSearchOpen,
  searchQuery, setSearchQuery, searchInputRef, closeSearch,
  error, isLoading, isAdmin, onSelect, onAdd,
}: {
  books: Book[];
  completedCount: number;
  readingCount: number;
  filteredBooks: Book[];
  sortBy: SortBy;
  setSortBy: Dispatch<SetStateAction<SortBy>>;
  isSearchOpen: boolean;
  setIsSearchOpen: Dispatch<SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  closeSearch: () => void;
  error: string;
  isLoading: boolean;
  isAdmin: boolean;
  onSelect: (id: string, source: "shelf" | "index") => void;
  onAdd: () => void;
}) {
  return (
      <section id="index" className="mx-auto max-w-[1540px] scroll-mt-8 px-5 pb-20 pt-14 sm:px-12 sm:pb-32 sm:pt-28 lg:px-16">
        <div className="mb-9 grid gap-7 border-t border-[#DCD8D0] border-b border-[#DCD8D0] pb-8 pt-8 sm:mb-12 sm:gap-10 sm:pb-10 sm:pt-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="mb-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6B665E]">002 / COLLECTION INDEX</p>
            <h2 className="text-[clamp(1.75rem,3vw,2.85rem)] font-normal leading-[0.98] tracking-[-0.075em]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>The index<span className="italic">.</span></h2>
            <p className="mt-5 font-sans text-[12px] leading-6 text-[#6B665E]">한 권 한 권, 읽어 온 시간의 목록.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-[11px] uppercase tracking-[0.12em] sm:gap-7">
            <span className="text-[#6B665E]">ALL <strong className="ml-1 font-medium text-[#24231f]">{pad(books.length)}</strong></span>
            <span className="text-[#6B665E]">READ <strong className="ml-1 font-medium text-[#24231f]">{pad(completedCount)}</strong></span>
            <span className="text-[#6B665E]">READING <strong className="ml-1 font-medium text-[#24231f]">{pad(readingCount)}</strong></span>
            <div className="flex items-center gap-3">
              <AnimatePresence initial={false}>
                {isSearchOpen && (
                  <motion.div
                    key="index-search"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "clamp(118px, 18vw, 220px)" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="overflow-hidden border-b border-black/35"
                  >
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }}
                      placeholder="책 제목 또는 작가"
                      aria-label="책 제목 또는 작가 검색"
                      className="w-full min-w-0 bg-transparent pb-1 font-sans text-[11px] normal-case tracking-normal outline-none placeholder:text-[#716C64]"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                type="button"
                onClick={() => { if (isSearchOpen) closeSearch(); else setIsSearchOpen(true); }}
                aria-label={isSearchOpen ? "검색 닫기" : "책 검색 열기"}
                aria-expanded={isSearchOpen}
                className="flex h-11 w-11 items-center justify-center text-[#34332f] transition-opacity hover:opacity-50 sm:h-7 sm:w-7"
              >
                {isSearchOpen ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M5 5l14 14M19 5L5 19" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 5 5" />
                  </svg>
                )}
              </button>
            </div>
            <label className="border-b border-black/30 pb-1">
              <span className="sr-only">책 정렬</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
                className="min-h-11 cursor-pointer bg-transparent text-[12px] font-medium uppercase tracking-[0.12em] outline-none sm:min-h-0 sm:text-[11px]"
              >
                <option value="latest">등록순</option>
                <option value="dateDesc">독서일순</option>
                <option value="titleAsc">제목순</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-4 font-sans text-[10px] uppercase tracking-[0.18em] text-[#6B665E]">
          <span>{searchQuery.trim() ? `SEARCH RESULTS / ${pad(filteredBooks.length)}` : "ARCHIVE ENTRIES"}</span>
          <span className="hidden sm:inline">TITLE / AUTHOR <span className="ml-6">STATUS / DATE</span></span>
        </div>

        {error && <p role="alert" className="my-8 text-sm text-red-700">{error}</p>}
        {isLoading ? (
          <div className="py-24 text-center text-[11px] tracking-widest text-[#6B665E]">LOADING COLLECTION...</div>
        ) : books.length === 0 ? (
          <div className="py-24 text-center text-sm text-[#6B665E]">{isAdmin ? "아직 기록된 책이 없어요. ADD BOOK으로 첫 책을 추가해 보세요." : "아직 기록된 책이 없어요."}</div>
        ) : filteredBooks.length === 0 ? (
          <div className="py-24 text-center font-sans text-sm text-[#6B665E]">검색 결과가 없어요. 다른 제목이나 작가를 입력해 보세요.</div>
        ) : (
          <div>
            {filteredBooks.map((book, index) => (
              <motion.button
                key={book.id}
                type="button"
                onClick={() => onSelect(book.id, "index")}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.32, delay: Math.min(index, 8) * 0.03 }}
                className="group grid w-full grid-cols-[24px_40px_minmax(0,1fr)_20px] items-center gap-2 border-b border-[#E6E2DB] py-4 text-left transition-colors duration-300 hover:bg-[#F3F1EC] focus-visible:bg-[#F3F1EC] sm:grid-cols-[48px_50px_minmax(0,1fr)_110px_112px_24px] sm:gap-6 sm:py-5"
              >
                <span className="font-mono text-[11px] text-[#6B665E]">{String(index + 1).padStart(3, "0")}</span>
                <BookCover book={book} className="aspect-[2/3] w-[40px] shadow-sm sm:w-[50px]" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-normal leading-[1.5] tracking-[-0.015em] transition-colors group-hover:text-[#54524D] sm:text-[15px]" style={{ fontFamily: BOOK_TITLE_FONT }}>{book.title}</span>
                  <span className="mt-0.5 block truncate font-sans text-[11px] text-[#6B665E]">{book.author}</span>
                </span>
                <span className="hidden text-[11px] text-[#79776F] sm:block">{book.status === "읽는 중" && getReadingProgress(book) ? `읽는 중 · ${getReadingProgress(book)?.percent}%` : book.status}</span>
                <span className="hidden font-mono text-[11px] text-[#6B665E] sm:block">{book.date}</span>
                <span className="text-lg text-[#6B665E] transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-[#1A1A18]">↗</span>
              </motion.button>
            ))}
          </div>
        )}

        <footer className="mt-24 flex flex-wrap items-end justify-between gap-6 border-t border-[#DCD8D0] pt-8 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B665E]">
          <span>KWON'S ARCHIVE <span className="mx-2 text-[#C8C1B7]">/</span> A COLLECTION OF STORIES</span>
          <span className="font-mono text-[10px] tracking-[0.16em] text-[#6B665E]">END OF INDEX&nbsp; — &nbsp; VOL. 01</span>
          {isAdmin && <button type="button" onClick={onAdd} className="border-b border-[#8D877E] pb-1 text-[#24231f] transition-opacity hover:opacity-50">+ ADD A BOOK ↗</button>}
        </footer>
      </section>

  );
}
