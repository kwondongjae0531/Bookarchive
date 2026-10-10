import type { Book, BookForm } from "./types";

export const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1495640388908-05fa85288e61?auto=format&fit=crop&q=80&w=800";
export const BOOKS_PER_SHELF_PAGE = 10;
// 이전 화면의 font-serif 계열과 비슷한 Mac 한글 명조체를 우선 사용합니다.
// 시스템에 폰트가 없을 경우 뒤쪽 글꼴로 자동 대체됩니다.
export const BOOK_TITLE_FONT = '"AppleMyungjo", "Nanum Myeongjo", "Batang", Georgia, serif';
export const pad = (n: number) => String(n).padStart(2, "0");

// 페이지 정보를 입력한 '읽는 중' 책에만 독서 진행률을 표시합니다.
// 레거시 문서와 숫자가 잘못된 문서는 건너뜁니다.
export function getReadingProgress(book: Book) {
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

/** Firestore 예전 날짜(YYYY.MM.DD)와 새 날짜(YYYY-MM-DD)를 입력창 형식으로 정규화합니다. */
export function toInputDate(value: string | undefined): string {
  if (!value) return "";
  const normalized = value.replace(/\./g, "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

/** 예전 문서에는 date 한 개만 있었습니다. 완독의 date는 완독일, 읽는 중은 시작일로 간주합니다. */
export function getBookStartDate(book: Book): string {
  return typeof book.startDate === "string"
    ? toInputDate(book.startDate)
    : book.status === "읽는 중" ? toInputDate(book.date) : "";
}

export function getBookFinishedDate(book: Book): string {
  return typeof book.finishedDate === "string"
    ? toInputDate(book.finishedDate)
    : book.status === "완독" ? toInputDate(book.date) : "";
}

/** 기존 INDEX의 등록일순/독서일순 정렬과 구형 클라이언트를 위한 날짜 값입니다. */
export function dateForLegacySort(status: Book["status"], startDate: string, finishedDate: string): string {
  return (status === "완독" ? finishedDate : startDate).replace(/-/g, ".");
}

/** 시작일·완독일 모두 있는 완독 책의 독서 소요일(시작일과 완독일 사이의 차이). */
export function getReadingDurationDays(book: Book): number | null {
  if (book.status !== "완독") return null;
  const start = getBookStartDate(book);
  const finished = getBookFinishedDate(book);
  if (!start || !finished) return null;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [fy, fm, fd] = finished.split("-").map(Number);
  const diff = Math.round((Date.UTC(fy, fm - 1, fd) - Date.UTC(sy, sm - 1, sd)) / 86400000);
  return diff >= 0 && Number.isFinite(diff) ? diff : null;
}

export function todayString() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

export function emptyForm(): BookForm {
  return {
    title: "",
    author: "",
    startDate: "",
    finishedDate: "",
    imageUrl: "",
    status: "완독",
    quote: "",
    review: "",
    totalPages: "",
    currentPage: "",
  };
}

