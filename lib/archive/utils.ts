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

export function todayString() {
  const today = new Date();
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

export function emptyForm(): BookForm {
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

