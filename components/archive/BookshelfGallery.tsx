"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { Book } from "../../lib/archive/types";
import { BOOKS_PER_SHELF_PAGE, BOOK_TITLE_FONT, getReadingProgress, pad } from "../../lib/archive/utils";
import BookCover from "./BookCover";

export default function BookshelfGallery({
  books,
  onSelect,
  onAdd,
  onOpenTrash,
  onOpenBackup,
  isLoading,
  isAdmin,
  authUser,
  authReady,
  authBusy,
  authError,
  hasAdminConfig,
  onLogin,
  onLogout,
}: {
  books: Book[];
  onSelect: (bookId: string, source: "shelf" | "index") => void;
  onAdd: () => void;
  onOpenTrash: () => void;
  onOpenBackup: () => void;
  isLoading: boolean;
  isAdmin: boolean;
  authUser: User | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string;
  hasAdminConfig: boolean;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const [page, setPage] = useState(0);
  const reducedMotion = useReducedMotion();
  const pageCount = Math.max(1, Math.ceil(books.length / BOOKS_PER_SHELF_PAGE));
  const activePage = Math.min(page, pageCount - 1);
  const visibleBooks = useMemo(
    () => books.slice(activePage * BOOKS_PER_SHELF_PAGE, (activePage + 1) * BOOKS_PER_SHELF_PAGE),
    [books, activePage]
  );

  return (
    <section id="gallery" className="relative isolate min-h-[600px] bg-white text-[#181818]">
      <header className="relative z-30 mx-auto flex w-full max-w-[1600px] flex-col items-start justify-between gap-4 border-b border-[#E9E6E0] px-5 py-6 font-sans sm:flex-row sm:items-center sm:px-12 sm:py-9 lg:px-16">
        <a href="#gallery" className="text-[21px] font-black leading-[0.97] tracking-[-0.055em] sm:text-[21px] lg:text-[26px]" aria-label="아카이브 처음으로">
          KWON&apos;S<br />ARCHIVE<span className="ml-0.5 align-top text-[8px] font-normal">®</span>
        </a>
        <p className="hidden text-[10px] font-medium uppercase tracking-[0.22em] text-[#6B665E] md:block">
          AN ARCHIVE OF READING & REMEMBERING
        </p>
        <nav className="flex w-full flex-wrap items-center justify-start gap-x-4 gap-y-1 border-t border-[#E9E6E0] pt-3 sm:w-auto sm:justify-end sm:gap-x-8 sm:border-t-0 sm:pt-0" aria-label="주 메뉴">
          <a href="#index" className="inline-flex min-h-11 items-center text-[12px] font-semibold uppercase tracking-[0.13em] transition-opacity hover:opacity-45 sm:min-h-0 sm:text-[11px]">INDEX</a>
          {isAdmin && (
            <button type="button" onClick={onAdd} className="inline-flex min-h-11 items-center border-b border-black text-[12px] font-semibold uppercase tracking-[0.13em] transition-opacity hover:opacity-45 sm:min-h-0 sm:pb-1 sm:text-[11px]">
              + ADD BOOK
            </button>
          )}
          {isAdmin && (
            <button type="button" onClick={onOpenTrash} className="inline-flex min-h-11 items-center text-[12px] font-semibold uppercase tracking-[0.13em] text-[#77746e] transition-opacity hover:opacity-45 sm:min-h-0 sm:text-[11px]">
              TRASH
            </button>
          )}
          {isAdmin && (
            <button type="button" onClick={onOpenBackup} className="inline-flex min-h-11 items-center text-[12px] font-semibold uppercase tracking-[0.13em] text-[#77746e] transition-opacity hover:opacity-45 sm:min-h-0 sm:text-[11px]">
              BACKUP
            </button>
          )}
          <button
            type="button"
            disabled={!authReady || authBusy}
            onClick={authUser ? onLogout : onLogin}
            className="inline-flex min-h-11 items-center text-[12px] font-semibold uppercase tracking-[0.13em] text-[#55534e] transition-opacity hover:opacity-45 disabled:opacity-35 sm:min-h-0 sm:text-[11px]"
          >
            {!authReady || authBusy ? "WAIT..." : authUser ? "LOG OUT" : "ADMIN LOGIN"}
          </button>
        </nav>
      </header>
      {authError && (
        <p role="alert" className="mx-auto w-full max-w-[1500px] px-6 font-sans text-xs text-red-700 sm:px-12 lg:px-16">
          {authError}
        </p>
      )}
      {authReady && authUser && !isAdmin && (
        <div className="mx-auto w-full max-w-[1500px] px-6 font-sans text-[11px] leading-6 text-[#6a6862] sm:px-12 lg:px-16">
          {hasAdminConfig
            ? "현재 Google 계정에는 관리자 권한이 없어요. 올바른 계정으로 로그인해주세요."
            : "관리자 UID가 아직 설정되지 않았어요. 아래 UID를 복사해 .env.local과 Firestore 보안 규칙에 설정해주세요."}
          {!hasAdminConfig && <div className="mt-1 break-all font-mono text-[11px] text-[#24231f]">UID: {authUser.uid}</div>}
        </div>
      )}

      <div className="mx-auto w-full max-w-[1500px] px-5 pb-12 pt-12 sm:px-12 sm:pb-24 sm:pt-24 lg:px-16 lg:pt-28">
        <div className="mb-10 border-b border-[#DCD8D0] pb-8 sm:mb-20 sm:pb-12">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3 font-sans text-[10px] uppercase tracking-[0.22em] text-[#6B665E] sm:mb-10">
            <p>001 <span className="mx-2 text-[#C8C1B7]">/</span> THE COLLECTION</p>
            <p>VOL. 01 <span className="mx-2 text-[#C8C1B7]">—</span> PERSONAL EDITION</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-[720px]">
              <h1 className="text-[clamp(1.85rem,3.65vw,3.05rem)] font-normal leading-[0.94] tracking-[-0.085em]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
                The shelf<span className="italic">.</span>
              </h1>
              <p className="mt-6 max-w-[480px] font-sans text-[12px] leading-[1.85] tracking-[0.025em] text-[#6B665E] sm:mt-8 sm:text-[13px]">
                읽고, 오래 곁에 두고 싶은 이야기들을 모아 둔 작은 서재.
              </p>
            </div>
            <div className="min-w-[110px] border-l border-[#DCD8D0] pl-5 text-right sm:pl-7">
              <p className="font-mono text-[clamp(1.5rem,3.3vw,2.4rem)] leading-none tracking-[-0.06em] text-[#33312D]">{pad(books.length)}</p>
              <p className="mt-2 font-sans text-[10px] uppercase tracking-[0.2em] text-[#6B665E]">BOOKS IN ARCHIVE</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[410px] items-center justify-center font-sans text-[11px] tracking-[0.2em] text-[#6B665E]">
            LOADING COLLECTION...
          </div>
        ) : books.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-5 text-center">
            <p className="font-sans text-[11px] tracking-[0.2em] text-[#6B665E]">AN EMPTY SHELF</p>
            <p className="text-base" style={{ fontFamily: BOOK_TITLE_FONT }}>첫 책을 진열해 볼까요?</p>
            {isAdmin && <button type="button" onClick={onAdd} className="border-b border-black pb-1 font-sans text-xs">+ 첫 책 추가하기</button>}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap justify-center gap-x-0 gap-y-10 sm:gap-y-16 lg:gap-y-20">
              {visibleBooks.map((book, index) => (
                <div key={book.id} className="group relative flex w-1/2 min-w-0 shrink-0 flex-col justify-end sm:w-1/3 lg:w-1/5" style={{ perspective: '900px' }}>
                  {/* 갤러리의 벽과 책 사이에 넓은 흰 여백을 남깁니다. */}
                  <div className="relative flex h-[210px] items-end justify-center pb-1 sm:h-[280px] lg:h-[305px]">
                    {/* 전시관처럼 차분하게 퍼지는 은은한 조명 */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-x-2 -inset-y-5 z-0 bg-[radial-gradient(ellipse_60%_62%_at_50%_55%,rgba(224,217,202,0.42)_0%,rgba(246,243,237,0.25)_47%,rgba(255,255,255,0)_83%)] opacity-0 blur-[5px] transition-opacity duration-500 group-hover:opacity-100 group-focus-within:opacity-100"
                    />
                    <motion.button
                      type="button"
                      onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onSelect(book.id, "shelf"); }}
                      initial={reducedMotion ? false : { opacity: 0, y: 13 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.42, delay: Math.min(index, 7) * 0.045, ease: "easeOut" }}
                      whileHover={reducedMotion ? undefined : { y: -8, z: 18, scale: 1.035, rotateY: -1.5, transition: { duration: 0.34, ease: "easeOut" } }}
                      whileFocus={reducedMotion ? undefined : { y: -6, z: 12, scale: 1.025, transition: { duration: 0.28 } }}
                      whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                      aria-label={`${book.title} 상세 기록 열기`}
                      className="relative z-10 block w-[min(80%,146px)] origin-bottom cursor-pointer outline-none [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-black sm:w-[min(76%,178px)] lg:w-[min(78%,184px)]"
                    >
                      <motion.div
                        layoutId={reducedMotion ? undefined : `archive-cover-${book.id}`}
                        transition={{ layout: { type: "spring", stiffness: 220, damping: 28 } }}
                        className="relative aspect-[2/3] w-full bg-[#ecebea] shadow-[2px_6px_13px_rgba(0,0,0,0.12)] transition-shadow duration-500 group-hover:shadow-[5px_17px_26px_rgba(0,0,0,0.14)] group-focus-within:shadow-[5px_17px_26px_rgba(0,0,0,0.14)]"
                      >
                        <BookCover book={book} eager={index < 5} className="h-full w-full" />
                        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-[6px] bg-gradient-to-r from-black/25 to-transparent" />
                        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[2px] bg-white/25" />
                        {/* 조명이 닿으면 표지 위를 희미하게 지나가는 반사광 */}
                        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(112deg,transparent_15%,rgba(255,255,255,0.18)_47%,transparent_69%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-within:opacity-100" />
                      </motion.div>
                    </motion.button>
                  </div>

                  {/* 선 하나로만 책장을 표현합니다: 나무 질감 / 두꺼운 3D 박스 사용 안 함. */}
                  <div aria-hidden="true" className="relative z-0 h-[6px] w-full border-t border-[#BEB9B0] bg-gradient-to-b from-[#EEECE7] via-[#F9F8F5] to-transparent" />

                  {/* 미술관 캡션처럼, 번호와 제목을 작게 정렬한 책 라벨 */}
                  <button type="button" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onSelect(book.id, "shelf"); }} className="relative flex h-[112px] w-full flex-col items-start overflow-hidden px-2 pt-4 text-left outline-none transition-opacity duration-300 hover:opacity-70 focus-visible:underline sm:h-[108px] sm:px-5 sm:pt-5 lg:px-7">
                    <span className="mb-3 flex w-full items-center justify-between gap-1 border-b border-[#E4E0D9] pb-2 font-mono text-[10px] leading-none tracking-[0.09em] text-[#6B665E]">
                      <span>NO. {String(activePage * BOOKS_PER_SHELF_PAGE + index + 1).padStart(3, "0")}</span>
                      <span className="truncate text-[10px]">{book.status === "읽는 중" ? (getReadingProgress(book) ? `${getReadingProgress(book)?.percent}% READ` : "READING") : "FINISHED"}</span>
                    </span>
                    <span className="block w-full truncate text-[13px] leading-[1.4] tracking-[-0.025em] text-[#30302f] sm:text-[14px]" style={{ fontFamily: BOOK_TITLE_FONT }}>{book.title}</span>
                    <span className="mt-1.5 block w-full truncate font-sans text-[11px] leading-[1.35] text-[#6B665E]">{book.author}</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-14 flex min-h-10 flex-wrap items-center justify-between gap-4 border-t border-[#DCD8D0] pt-6 font-sans sm:mt-24">
              <p className="text-[10px] uppercase tracking-[0.19em] text-[#6B665E]">A CURATED RECORD OF READING <span className="mx-2 text-[#C8C1B7]">/</span> SELECT A BOOK TO EXPLORE</p>
              {pageCount > 1 && (
                <div className="flex items-center gap-6 text-[11px] tracking-[0.14em]">
                  <button type="button" disabled={activePage === 0} onClick={() => setPage((n) => Math.max(0, n - 1))} className="flex min-h-11 min-w-11 items-center justify-center text-base disabled:opacity-20 sm:min-h-0 sm:min-w-0" aria-label="이전 책장">←</button>
                  <span className="font-mono text-[#75736d]">{pad(activePage + 1)} / {pad(pageCount)}</span>
                  <button type="button" disabled={activePage === pageCount - 1} onClick={() => setPage((n) => Math.min(pageCount - 1, n + 1))} className="flex min-h-11 min-w-11 items-center justify-center text-base disabled:opacity-20 sm:min-h-0 sm:min-w-0" aria-label="다음 책장">→</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

