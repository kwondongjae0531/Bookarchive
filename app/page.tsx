"use client";

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { db } from "./firebase";

/*
 * KWON'S ARCHIVE — EDITION 10 · THE EDITORIAL SHELF
 * 순백색 전시 공간, 책 수에 맞춰 가운데 놓이는 선반, 은은한 조명, 작품 라벨, 펼쳐지는 독서 노트.
 * 한글 책 제목은 이전 서재 화면의 명조 계열 서체로 표현합니다.
 * 기존 Firebase books 구조와 검색/독서 기록을 유지하며 관리자 전용 trash 컬렉션을 추가합니다.
 * Google sign-in + UID-gated editing UI. Actual write protection REQUIRES the Firestore rules supplied separately.
 * 별도 패키지 설치 불필요: 기존 React / Framer Motion / Firebase Auth만 사용.
 */

type ReadingStatus = "완독" | "읽는 중";
type SortBy = "latest" | "dateDesc" | "titleAsc";

interface Book {
  id: string;
  title: string;
  author: string;
  date: string;
  imageUrl: string;
  status: ReadingStatus;
  review?: string;
  quote?: string;
  createdAt?: number;
  // 기존 책 문서에 필드가 없어도 정상 작동합니다.
  totalPages?: number;
  currentPage?: number;
}

// 입력 중에는 빈 값을 허용할 수 있도록 페이지 입력을 문자열로 관리합니다.
type BookForm = Omit<Book, "id" | "createdAt" | "totalPages" | "currentPage"> & {
  totalPages: string;
  currentPage: string;
};
type TrashBook = Book & { trashedAt?: number };

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1495640388908-05fa85288e61?auto=format&fit=crop&q=80&w=800";
const BOOKS_PER_SHELF_PAGE = 10;
// 이전 화면의 font-serif 계열과 비슷한 Mac 한글 명조체를 우선 사용합니다.
// 시스템에 폰트가 없을 경우 뒤쪽 글꼴로 자동 대체됩니다.
const BOOK_TITLE_FONT = '"AppleMyungjo", "Nanum Myeongjo", "Batang", Georgia, serif';
const pad = (n: number) => String(n).padStart(2, "0");

// 페이지 정보를 입력한 '읽는 중' 책에만 독서 진행률을 표시합니다.
// 레거시 문서와 숫자가 잘못된 문서는 건너뜁니다.
function getReadingProgress(book: Book) {
  const total = book.totalPages;
  const current = book.currentPage;
  if (
    book.status !== "읽는 중" ||
    typeof total !== "number" || !Number.isSafeInteger(total) || total <= 0 ||
    typeof current !== "number" || !Number.isSafeInteger(current) ||
    current < 0 || current > total
  ) return null;
  return { current, total, percent: Math.round((current / total) * 100) };
}

function todayString() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

function emptyForm(): BookForm {
  return {
    title: "",
    author: "",
    date: "",
    imageUrl: "",
    status: "완독",
    quote: "",
    review: "",
    totalPages: "",
    currentPage: "",
  };
}

function BookCover({
  book,
  className = "",
  eager = false,
}: {
  book: Book;
  className?: string;
  eager?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-[#e4e0da] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={book.imageUrl || FALLBACK_COVER}
        alt={`${book.title} 표지`}
        loading={eager ? "eager" : "lazy"}
        draggable={false}
        className="h-full w-full select-none object-cover"
        onError={(event) => {
          if (event.currentTarget.src !== FALLBACK_COVER) {
            event.currentTarget.src = FALLBACK_COVER;
          }
        }}
      />
    </div>
  );
}

/**
 * EDITION 09 — THE CENTERED SHELF
 * 책마다 번호와 라벨이 있는 미니멀 전시 책장.
 * hover/focus 시 은은한 스포트라이트와 입체감.
 * 책장 표지와 상세 기록 사이에 shared layout 전환을 적용.
 * 각 책을 동일한 폭의 선반 모듈로 구성하고 flex-wrap/justify-center로
 * 마지막 줄에 책이 적게 남아도 선반과 표지가 함께 중앙에 정렬됩니다.
 */
function BookshelfGallery({
  books,
  onSelect,
  onAdd,
  onOpenTrash,
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
                      onClick={() => onSelect(book.id, "shelf")}
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
                  <button type="button" onClick={() => onSelect(book.id, "shelf")} className="relative flex h-[112px] w-full flex-col items-start overflow-hidden px-2 pt-4 text-left outline-none transition-opacity duration-300 hover:opacity-70 focus-visible:underline sm:h-[108px] sm:px-5 sm:pt-5 lg:px-7">
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

/**
 * 책 상세 화면에서 바로 페이지를 기록합니다.
 * 관리자가 아닌 방문자에게는 진행률만 표시합니다.
 */
function ReadingProgressPanel({
  bookId,
  bookTitle,
  currentPage,
  totalPages,
  isAdmin,
  onSaved,
}: {
  bookId: string;
  bookTitle: string;
  currentPage: number;
  totalPages: number;
  isAdmin: boolean;
  onSaved: () => Promise<void>;
}) {
  const [draftPage, setDraftPage] = useState(String(currentPage));
  const [isSavingPage, setIsSavingPage] = useState(false);
  const [feedback, setFeedback] = useState("");

  const trimmed = draftPage.trim();
  const value = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  const isValidPage = Number.isSafeInteger(value) && value >= 0 && value <= totalPages;
  const displayPage = isValidPage ? value : currentPage;
  const percent = Math.round((displayPage / totalPages) * 100);
  const isChanged = isValidPage && value !== currentPage;

  function addPages(amount: number) {
    if (isSavingPage) return;
    const fromPage = isValidPage ? value : currentPage;
    setDraftPage(String(Math.min(totalPages, fromPage + amount)));
    setFeedback("");
  }

  async function savePages() {
    if (!isAdmin || isSavingPage) return;
    if (!isValidPage) {
      setFeedback(`0쪽부터 ${totalPages}쪽 사이의 정수를 입력해주세요.`);
      return;
    }
    if (!isChanged) return;

    // 100% 도달해도 사용자가 선택하기 전에는 완독으로 바꾸지 않습니다.
    const markCompleted =
      value === totalPages && currentPage < totalPages &&
      window.confirm("끝까지 읽었네요! 이 책을 '완독'으로 변경할까요?\n취소하면 '읽는 중' 100%로 저장돼요.");

    setIsSavingPage(true);
    setFeedback("");
    try {
      await updateDoc(doc(db, "books", bookId), {
        currentPage: value,
        ...(markCompleted ? { status: "완독" as ReadingStatus } : {}),
      });
      await onSaved();
      setFeedback(markCompleted ? "완독으로 기록했어요." : "읽은 페이지를 저장했어요.");
    } catch (err) {
      console.error("읽은 페이지 업데이트 오류:", err);
      setFeedback("저장하지 못했어요. 연결 상태나 Firebase 권한을 확인해주세요.");
    } finally {
      setIsSavingPage(false);
    }
  }

  return (
    <div className="mt-9 font-sans">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[11px] tracking-[0.035em] text-[#57534D]">
        <span className="text-[10px] font-semibold uppercase tracking-[0.17em] text-[#6B665E]">READING PROGRESS</span>
        <span className="font-mono tabular-nums">
          {displayPage} / {totalPages} PAGES
          <span className="ml-3 font-semibold text-[#25231F]">{percent}%</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${bookTitle} 독서 진행률`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-[5px] w-full overflow-hidden bg-[#E7E4DE]"
      >
        <div className="h-full bg-[#34322E] transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
      </div>
      {isAdmin && (
        <div className="mt-5 border-t border-[#E4E0D9] pt-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B665E]">QUICK UPDATE / 빠른 페이지 기록</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 5, 10, 20].map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={isSavingPage || displayPage >= totalPages}
                onClick={() => addPages(amount)}
                className="min-h-11 border border-[#DCD8D0] bg-white px-3 py-2 text-[12px] font-semibold text-[#403C36] transition-colors hover:bg-[#F5F3EF] disabled:cursor-not-allowed disabled:opacity-40"
              >
                +{amount}쪽
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="min-w-[130px] flex-1 text-[11px] text-[#57534D]">
              현재 읽은 페이지
              <input
                type="number"
                min={0}
                max={totalPages}
                step={1}
                inputMode="numeric"
                disabled={isSavingPage}
                value={draftPage}
                onChange={(event) => { setDraftPage(event.target.value); setFeedback(""); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void savePages();
                  }
                }}
                aria-invalid={draftPage !== "" && !isValidPage}
                className="mt-2 block min-h-11 w-full border border-[#C9C5BE] bg-white px-3 text-[16px] text-[#25231F] outline-none focus:border-[#25231F]"
              />
            </label>
            <button
              type="button"
              disabled={isSavingPage || !isChanged}
              onClick={() => void savePages()}
              className="min-h-11 bg-[#25231F] px-6 text-[12px] font-semibold tracking-[0.08em] text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSavingPage ? "SAVING..." : "SAVE PAGES ↗"}
            </button>
          </div>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-[11px] leading-5 text-[#6B665E]">
            {feedback || (isChanged ? "변경된 페이지는 저장 버튼을 누르면 반영돼요." : "")}
          </p>
        </div>
      )}
    </div>
  );
}

const fieldClass =
  "mt-2 block w-full rounded-none border-b border-[#c9c7c1] bg-transparent px-0 py-3 text-[16px] text-[#262520] outline-none placeholder:text-[#716C64] focus:border-[#24231f] sm:text-[14px]";

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("dateDesc");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectionSource, setSelectionSource] = useState<"shelf" | "index">("shelf");
  const [form, setForm] = useState<BookForm>(emptyForm);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [trashedBooks, setTrashedBooks] = useState<TrashBook[]>([]);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState("");
  const [trashBusyId, setTrashBusyId] = useState<string | null>(null);
  // 이 값은 클라이언트 UI용입니다. 실제 보안은 별도 Firestore Rules가 담당합니다.
  const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "";
  const isAdmin = Boolean(authUser && adminUid && authUser.uid === adminUid);

  useEffect(() => {
    const auth = getAuth(db.app);
    return onAuthStateChanged(
      auth,
      (user) => {
        setAuthUser(user);
        if (!user || user.uid !== (process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "")) {
          setIsTrashOpen(false);
          setTrashedBooks([]);
        }
        setAuthReady(true);
        setAuthError("");
      },
      (error) => {
        console.error("Firebase Authentication 오류:", error);
        setAuthReady(true);
        setAuthError("로그인 상태를 확인할 수 없어요. Firebase Authentication 설정을 확인해주세요.");
      }
    );
  }, []);

  async function handleLogin() {
    setAuthBusy(true);
    setAuthError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(getAuth(db.app), provider);
    } catch (error) {
      console.error("구글 로그인 오류:", error);
      const code = (error as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setAuthError(
          code === "auth/unauthorized-domain"
            ? "현재 주소가 Firebase Authentication의 승인된 도메인에 없어요. Firebase 콘솔에서 도메인을 추가해주세요."
            : code === "auth/operation-not-allowed"
              ? "Firebase 콘솔에서 Google 로그인 제공업체를 활성화해주세요."
              : "구글 로그인에 실패했어요. 팝업 차단 설정과 Firebase 인증 설정을 확인해주세요."
        );
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    setAuthBusy(true);
    try {
      await signOut(getAuth(db.app));
      setIsFormOpen(false);
      setEditingBookId(null);
      setIsTrashOpen(false);
      setTrashedBooks([]);
    } catch (error) {
      console.error("로그아웃 오류:", error);
      setAuthError("로그아웃에 실패했어요. 다시 시도해주세요.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function fetchBooks() {
    try {
      const snapshot = await getDocs(collection(db, "books"));
      const data = snapshot.docs.map((item) => {
        const value = item.data();
        return {
          id: item.id,
          title: value.title || "제목 없음",
          author: value.author || "작가 미상",
          date: value.date || "",
          imageUrl: value.imageUrl || FALLBACK_COVER,
          status: value.status === "읽는 중" ? "읽는 중" : "완독",
          review: value.review || "",
          quote: value.quote || "",
          createdAt: typeof value.createdAt === "number" ? value.createdAt : undefined,
          totalPages: typeof value.totalPages === "number" ? value.totalPages : undefined,
          currentPage: typeof value.currentPage === "number" ? value.currentPage : undefined,
        } as Book;
      });
      setBooks(data);
      setError("");
    } catch (err) {
      console.error(err);
      const code = (err as { code?: string })?.code;
      setError(code === "permission-denied"
        ? "책을 불러올 권한이 없어요. Firestore 보안 규칙에서 books 읽기가 허용되어 있는지 확인해주세요."
        : "책 목록을 불러오지 못했어요. Firebase 연결을 확인해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { void fetchBooks(); }, []);

  async function fetchTrash() {
    if (!isAdmin) return;
    setIsTrashLoading(true);
    setTrashError("");
    try {
      const snapshot = await getDocs(collection(db, "trash"));
      const data = snapshot.docs.map((item) => {
        const value = item.data();
        return {
          id: item.id,
          title: value.title || "제목 없음",
          author: value.author || "작가 미상",
          date: value.date || "",
          imageUrl: value.imageUrl || FALLBACK_COVER,
          status: value.status === "읽는 중" ? "읽는 중" : "완독",
          review: value.review || "",
          quote: value.quote || "",
          createdAt: typeof value.createdAt === "number" ? value.createdAt : undefined,
          totalPages: typeof value.totalPages === "number" ? value.totalPages : undefined,
          currentPage: typeof value.currentPage === "number" ? value.currentPage : undefined,
          trashedAt: typeof value.trashedAt === "number" ? value.trashedAt : undefined,
        } as TrashBook;
      });
      setTrashedBooks(data.sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)));
    } catch (err) {
      console.error("Firestore 휴지통 조회 오류:", err);
      const code = (err as { code?: string })?.code;
      setTrashError(code === "permission-denied"
        ? "휴지통 접근 권한이 없어요. Firestore 규칙에 trash 컬렉션의 관리자 읽기 권한을 추가했는지 확인해주세요."
        : "휴지통을 불러오지 못했어요. 잠시 뒤 다시 시도해주세요.");
    } finally {
      setIsTrashLoading(false);
    }
  }

  function openTrash() {
    if (!isAdmin) return;
    setSelectedBookId(null);
    setIsTrashOpen(true);
    void fetchTrash();
  }

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isFormOpen && !selectedBookId && !isTrashOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving && !trashBusyId) {
        setIsFormOpen(false);
        setSelectedBookId(null);
        setEditingBookId(null);
        setIsTrashOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFormOpen, selectedBookId, isTrashOpen, isSaving, trashBusyId]);

  const sortedBooks = useMemo(() => [...books].sort((a, b) => {
    if (sortBy === "dateDesc") return b.date.localeCompare(a.date);
    if (sortBy === "titleAsc") return a.title.localeCompare(b.title, "ko");
    return (b.createdAt ?? 0) - (a.createdAt ?? 0);
  }), [books, sortBy]);

  // 검색은 INDEX에서 적용됩니다. 책장은 전체 소장 도서를 페이지별로 표시합니다.
  const filteredBooks = useMemo(() => {
    const keyword = searchQuery.trim().toLocaleLowerCase();
    if (!keyword) return sortedBooks;
    return sortedBooks.filter((book) =>
      [book.title, book.author, book.status].some((value) =>
        value.toLocaleLowerCase().includes(keyword)
      )
    );
  }, [sortedBooks, searchQuery]);

  function closeSearch() {
    setIsSearchOpen(false);
    setSearchQuery("");
  }

  const selectedBook = books.find((book) => book.id === selectedBookId) ?? null;

  function selectBook(bookId: string, source: "shelf" | "index") {
    setSelectionSource(source);
    setSelectedBookId(bookId);
  }
  const completedCount = books.filter((book) => book.status === "완독").length;
  const readingCount = books.filter((book) => book.status === "읽는 중").length;

  function closeForm() {
    setIsFormOpen(false);
    setEditingBookId(null);
    setForm(emptyForm());
  }

  function openAddForm() {
    if (!isAdmin) return;
    setSelectedBookId(null);
    setEditingBookId(null);
    setForm({ ...emptyForm(), date: todayString() });
    setIsFormOpen(true);
  }

  function openEditForm(book: Book) {
    if (!isAdmin) return;
    setSelectedBookId(null);
    setEditingBookId(book.id);
    setForm({
      title: book.title,
      author: book.author,
      date: book.date.replace(/\./g, "-"),
      imageUrl: book.imageUrl,
      status: book.status,
      review: book.review || "",
      quote: book.quote || "",
      totalPages: typeof book.totalPages === "number" ? String(book.totalPages) : "",
      currentPage: typeof book.currentPage === "number" ? String(book.currentPage) : "",
    });
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) {
      window.alert("관리자 계정으로 로그인해야 저장할 수 있어요.");
      return;
    }
    if (!form.title.trim() || !form.author.trim()) {
      window.alert("책 제목과 작가를 입력해주세요.");
      return;
    }
    const totalText = form.totalPages.trim();
    const currentText = form.currentPage.trim();
    // 모든 페이지 값은 정수만 허용합니다. 0쪽부터 읽기 시작할 수 있습니다.
    // 값을 모두 비우면 진행률을 지우고 책 데이터는 보존합니다.
    if (form.status === "읽는 중") {
      if (currentText && !totalText) {
        window.alert("읽은 페이지를 입력하려면 전체 페이지 수도 입력해주세요.");
        return;
      }
      if (totalText && (!/^\d+$/.test(totalText) || !Number.isSafeInteger(Number(totalText)) || Number(totalText) <= 0)) {
        window.alert("전체 페이지 수는 1 이상의 정수로 입력해주세요.");
        return;
      }
      if (currentText && (!/^\d+$/.test(currentText) || !Number.isSafeInteger(Number(currentText)))) {
        window.alert("현재 읽은 페이지는 0 이상의 정수로 입력해주세요.");
        return;
      }
      if (totalText && currentText && Number(currentText) > Number(totalText)) {
        window.alert("현재 읽은 페이지는 전체 페이지 수를 초과할 수 없어요.");
        return;
      }
    }
    const totalPages = totalText && /^\d+$/.test(totalText) && Number.isSafeInteger(Number(totalText)) && Number(totalText) > 0
      ? Number(totalText) : null;
    const currentPage = totalPages !== null && currentText && /^\d+$/.test(currentText) && Number.isSafeInteger(Number(currentText))
      ? Math.min(Number(currentText), totalPages) : totalPages !== null ? 0 : null;
    setIsSaving(true);
    try {
      const bookData = {
        title: form.title.trim(),
        author: form.author.trim(),
        date: (form.date || todayString()).replace(/-/g, "."),
        imageUrl: form.imageUrl.trim() || FALLBACK_COVER,
        status: form.status,
        quote: form.quote?.trim() || "",
        review: form.review?.trim() || "",
        // null을 저장하면 기존 진행률을 안전하게 초기화할 수 있습니다.
        totalPages,
        currentPage,
      };
      if (editingBookId) {
        await updateDoc(doc(db, "books", editingBookId), bookData);
      } else {
        await addDoc(collection(db, "books"), { ...bookData, createdAt: Date.now() });
      }
      closeForm();
      await fetchBooks();
    } catch (err) {
      console.error("Firestore 책 저장 오류:", err);
      const code = (err as { code?: string })?.code;
      window.alert(code === "permission-denied"
        ? "저장 권한이 없어요. Firebase Authentication의 로그인 계정과 Firestore Rules의 관리자 UID를 확인해주세요."
        : code === "unavailable"
          ? "Firestore 서버에 연결하지 못했어요. 인터넷 연결과 Firebase 설정을 확인해주세요."
          : `책 저장에 실패했어요.${code ? `\n오류 코드: ${code}` : ""} 개발자 콘솔을 확인해주세요.`);
    } finally {
      setIsSaving(false);
    }
  }

  // 책을 영구 삭제하지 않고 별도의 관리자 전용 trash 컬렉션으로 옮깁니다.
  // Firestore 트랜잭션을 사용해 원본 삭제와 휴지통 저장을 원자적으로 수행합니다.
  async function handleDeleteBook(book: Book, event?: MouseEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    if (!isAdmin || trashBusyId) return;
    if (!window.confirm(`‘${book.title}’을(를) 휴지통으로 이동할까요?\n언제든 복원할 수 있어요.`)) return;
    setTrashBusyId(book.id);
    try {
      await runTransaction(db, async (transaction) => {
        const bookRef = doc(db, "books", book.id);
        const trashRef = doc(db, "trash", book.id);
        const [bookSnap, trashSnap] = await Promise.all([
          transaction.get(bookRef), transaction.get(trashRef),
        ]);
        if (!bookSnap.exists()) throw new Error("이미 삭제되었거나 존재하지 않는 책이에요.");
        if (trashSnap.exists()) throw new Error("휴지통에 같은 ID의 책이 이미 존재해요.");
        transaction.set(trashRef, { ...bookSnap.data(), trashedAt: Date.now() });
        transaction.delete(bookRef);
      });
      setSelectedBookId(null);
      await fetchBooks();
    } catch (err) {
      console.error("휴지통 이동 오류:", err);
      window.alert(`휴지통으로 옮기지 못했어요. Firestore의 trash 권한을 확인해주세요.\n${err instanceof Error ? err.message : ""}`);
    } finally {
      setTrashBusyId(null);
    }
  }

  async function handleRestoreBook(book: TrashBook) {
    if (!isAdmin || trashBusyId) return;
    setTrashBusyId(book.id);
    try {
      await runTransaction(db, async (transaction) => {
        const trashRef = doc(db, "trash", book.id);
        const bookRef = doc(db, "books", book.id);
        const [trashSnap, bookSnap] = await Promise.all([
          transaction.get(trashRef), transaction.get(bookRef),
        ]);
        if (!trashSnap.exists()) throw new Error("휴지통에 해당 책이 없어요.");
        if (bookSnap.exists()) throw new Error("책장에 같은 ID의 책이 이미 있어 복원할 수 없어요.");
        const { trashedAt: _trashedAt, ...originalData } = trashSnap.data();
        void _trashedAt;
        transaction.set(bookRef, originalData);
        transaction.delete(trashRef);
      });
      await Promise.all([fetchBooks(), fetchTrash()]);
    } catch (err) {
      console.error("책 복원 오류:", err);
      window.alert(`책을 복원하지 못했어요.\n${err instanceof Error ? err.message : ""}`);
    } finally {
      setTrashBusyId(null);
    }
  }

  async function handleDeleteForever(book: TrashBook) {
    if (!isAdmin || trashBusyId) return;
    if (!window.confirm(`‘${book.title}’을(를) 영구 삭제할까요?\n이 작업은 되돌릴 수 없으며 독서 노트도 사라져요.`)) return;
    const answer = window.prompt("영구 삭제하려면 '삭제'라고 정확히 입력해주세요.");
    if (answer !== "삭제") return;
    setTrashBusyId(book.id);
    try {
      await deleteDoc(doc(db, "trash", book.id));
      await fetchTrash();
    } catch (err) {
      console.error("책 영구 삭제 오류:", err);
      window.alert("영구 삭제에 실패했어요. 다시 시도해주세요.");
    } finally {
      setTrashBusyId(null);
    }
  }

  return (
    <LayoutGroup id="reading-archive-exhibition">
    <div className="min-h-screen bg-white text-[#1A1A18] selection:bg-[#22211f] selection:text-white" style={{ fontFamily: 'Georgia, "AppleMyungjo", "Nanum Myeongjo", "Batang", serif' }}>
      <BookshelfGallery
        books={sortedBooks}
        onSelect={selectBook}
        onAdd={openAddForm}
        onOpenTrash={openTrash}
        isLoading={isLoading}
        isAdmin={isAdmin}
        authUser={authUser}
        authReady={authReady}
        authBusy={authBusy}
        authError={authError}
        hasAdminConfig={Boolean(adminUid)}
        onLogin={() => void handleLogin()}
        onLogout={() => void handleLogout()}
      />

      {/* 찾기 쉽도록 INDEX 목록과 기존 검색/정렬 기능도 유지합니다. */}
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
                onClick={() => selectBook(book.id, "index")}
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
          {isAdmin && <button type="button" onClick={openAddForm} className="border-b border-[#8D877E] pb-1 text-[#24231f] transition-opacity hover:opacity-50">+ ADD A BOOK ↗</button>}
        </footer>
      </section>

      {/* 표지를 누르면 열리는 책 상세 기록 */}
      <AnimatePresence>
        {selectedBook && (
          <motion.div
            key="detail"
            layoutRoot
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1c1b]/40 p-0 backdrop-blur-[6px] sm:p-7"
            onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBookId(null); }}
          >
            <motion.section
              role="dialog" aria-modal="true" aria-label={`${selectedBook.title} 상세 기록`}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 22, scale: prefersReducedMotion ? 1 : 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 12, scale: 0.99 }}
              transition={{ duration: prefersReducedMotion ? 0.12 : 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-[100dvh] max-h-[100dvh] w-full max-w-[1080px] overflow-y-auto overscroll-contain border border-[#E2DED6] bg-white text-[#1A1A18] shadow-[0_24px_90px_rgba(0,0,0,.14)] sm:h-auto sm:max-h-[92vh]"
            >
              <button type="button" onClick={() => setSelectedBookId(null)} className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center bg-white/95 text-[25px] text-[#817e76] transition-colors hover:text-[#1A1A18] sm:right-7 sm:top-6" aria-label="상세 화면 닫기">×</button>
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
                  <h2 className="break-keep text-[clamp(1.85rem,4vw,4rem)] font-normal leading-[1.12] tracking-[-0.065em] sm:text-[clamp(2.15rem,4vw,4rem)]" style={{ fontFamily: BOOK_TITLE_FONT }}>{selectedBook.title}</h2>
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
                      onSaved={fetchBooks}
                    />
                  )}
                  {selectedBook.status === "읽는 중" && !getReadingProgress(selectedBook) && isAdmin && (
                    <button type="button" onClick={() => openEditForm(selectedBook)} className="mt-7 self-start border-b border-[#A9A39A] pb-1 font-sans text-[11px] tracking-[0.06em] text-[#57534D] hover:text-black">
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
                      <button type="button" onClick={() => openEditForm(selectedBook)} className="border-b border-black/50 pb-1">EDIT ↗</button>
                      <button type="button" onClick={(event) => void handleDeleteBook(selectedBook, event)} className="border-b border-red-800/45 pb-1 text-red-900">DELETE ↗</button>
                    </div>
                  )}
                </motion.div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 관리자에게만 보이는 휴지통. 원본 책은 관리자 전용 trash 컬렉션에 보관됩니다. */}
      <AnimatePresence>
        {isTrashOpen && isAdmin && (
          <motion.div
            key="trash"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#24231f]/45 p-0 backdrop-blur-[5px] sm:p-7"
            onMouseDown={(event) => { if (event.target === event.currentTarget && !trashBusyId) setIsTrashOpen(false); }}
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
                <button type="button" onClick={() => setIsTrashOpen(false)} disabled={Boolean(trashBusyId)} className="flex min-h-11 min-w-11 items-center justify-center text-2xl text-[#6B665E] hover:text-black disabled:opacity-30" aria-label="휴지통 닫기">×</button>
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
                          <button type="button" disabled={Boolean(trashBusyId)} onClick={() => void handleRestoreBook(book)} className="border-b border-black/50 pb-1 transition-opacity hover:opacity-50 disabled:opacity-30">RESTORE ↗</button>
                          <button type="button" disabled={Boolean(trashBusyId)} onClick={() => void handleDeleteForever(book)} className="border-b border-red-800/40 pb-1 text-red-900 transition-opacity hover:opacity-50 disabled:opacity-30">DELETE FOREVER</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-8 flex justify-end border-t border-black/10 pt-6">
                <button type="button" disabled={Boolean(trashBusyId)} onClick={() => void fetchTrash()} className="font-sans text-[11px] font-semibold tracking-[0.12em] text-[#77756F] transition-opacity hover:opacity-45 disabled:opacity-30">REFRESH ↗</button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Firebase 등록/수정 화면 */}
      <AnimatePresence>
        {isFormOpen && isAdmin && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#24231f]/45 p-0 backdrop-blur-[5px] sm:p-7"
            onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) closeForm(); }}
          >
            <motion.section
              role="dialog" aria-modal="true" aria-label={editingBookId ? "책 수정" : "책 등록"}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              className="h-[100dvh] max-h-[100dvh] w-full max-w-[710px] overflow-y-auto overscroll-contain bg-white p-5 text-[#1A1A18] shadow-[0_24px_90px_rgba(0,0,0,.18)] sm:h-auto sm:max-h-[92vh] sm:p-12"
            >
              <div className="mb-8 flex items-start justify-between gap-5 border-b border-black/15 pb-7">
                <div>
                  <p className="mb-4 text-[10px] font-semibold tracking-[0.23em] text-[#6B665E]">ARCHIVE EDITOR</p>
                  <h2 className="text-4xl font-normal tracking-[-0.07em] sm:text-5xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{editingBookId ? "Edit a book." : "Add a book."}</h2>
                </div>
                <button type="button" onClick={closeForm} disabled={isSaving} className="flex min-h-11 min-w-11 items-center justify-center text-2xl text-[#6B665E] hover:text-black" aria-label="입력창 닫기">×</button>
              </div>
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-7">
                <div className="grid gap-7 sm:grid-cols-2">
                  <label className="block text-[12px] text-[#77746c]">책 제목 *
                    <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="책 제목" className={fieldClass} />
                  </label>
                  <label className="block text-[12px] text-[#77746c]">작가 *
                    <input required value={form.author} onChange={(event) => setForm({ ...form, author: event.target.value })} placeholder="작가" className={fieldClass} />
                  </label>
                  <label className="block text-[12px] text-[#77746c]">독서 상태
                    <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ReadingStatus })} className={fieldClass}>
                      <option value="완독">완독</option><option value="읽는 중">읽는 중</option>
                    </select>
                  </label>
                  <label className="block text-[12px] text-[#77746c]">독서 날짜
                    <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className={fieldClass} />
                  </label>
                </div>
                {form.status === "읽는 중" && (
                  <div className="border-y border-[#E4E0D9] py-6 font-sans">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6B665E]">READING PROGRESS / 페이지 기록</p>
                    <p className="mb-5 text-[11px] leading-6 text-[#6B665E]">전체 페이지 수와 현재 읽은 페이지를 입력하면 책에 진행률이 표시돼요. 둘 다 비워둘 수도 있어요.</p>
                    <div className="grid grid-cols-2 gap-5">
                      <label className="block text-[12px] text-[#57534D]">전체 페이지 수
                        <input type="number" min={1} step={1} inputMode="numeric" value={form.totalPages} onChange={(event) => setForm({ ...form, totalPages: event.target.value })} placeholder="예: 350" className={fieldClass} />
                      </label>
                      <label className="block text-[12px] text-[#57534D]">현재 읽은 페이지
                        <input type="number" min={0} step={1} inputMode="numeric" value={form.currentPage} onChange={(event) => setForm({ ...form, currentPage: event.target.value })} placeholder="예: 140" className={fieldClass} />
                      </label>
                    </div>
                    {form.totalPages.trim() && /^\d+$/.test(form.totalPages.trim()) && Number.isSafeInteger(Number(form.totalPages)) && Number(form.totalPages) > 0 && /^\d*$/.test(form.currentPage.trim()) && Number.isSafeInteger(Number(form.currentPage || 0)) && Number(form.currentPage || 0) <= Number(form.totalPages) && (
                      <p className="mt-4 font-mono text-[11px] tabular-nums text-[#57534D]">
                        현재 진행률: {Math.round((Number(form.currentPage || 0) / Number(form.totalPages)) * 100)}%
                      </p>
                    )}
                  </div>
                )}
                <label className="block text-[12px] text-[#77746c]">책 표지 이미지 URL
                  <input type="url" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://..." className={fieldClass} />
                </label>
                <label className="block text-[12px] text-[#77746c]">기억하고 싶은 문장 (선택)
                  <textarea rows={2} value={form.quote || ""} onChange={(event) => setForm({ ...form, quote: event.target.value })} placeholder="오래 기억하고 싶은 한 문장" className={`${fieldClass} resize-y`} />
                </label>
                <label className="block text-[12px] text-[#77746c]">독서 감상 (선택)
                  <textarea rows={4} value={form.review || ""} onChange={(event) => setForm({ ...form, review: event.target.value })} placeholder="책을 읽고 난 후의 생각들" className={`${fieldClass} resize-y`} />
                </label>
                <div className="flex justify-end gap-6 border-t border-black/15 pt-7 text-[11px] font-semibold uppercase tracking-[0.14em]">
                  <button type="button" disabled={isSaving} onClick={closeForm} className="text-[#77756F] hover:text-black">CANCEL</button>
                  <button type="submit" disabled={isSaving} className="bg-[#1B1B19] px-7 py-4 text-white transition-colors hover:bg-[#494841] disabled:opacity-50">
                    {isSaving ? "SAVING..." : editingBookId ? "SAVE CHANGES ↗" : "ADD BOOK ↗"}
                  </button>
                </div>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </LayoutGroup>
  );
}
