export type ReadingStatus = "완독" | "읽는 중";
export type SortBy = "latest" | "dateDesc" | "titleAsc";

export interface Book {
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
export type BookForm = Omit<Book, "id" | "createdAt" | "totalPages" | "currentPage"> & {
  totalPages: string;
  currentPage: string;
};
export type TrashBook = Book & { trashedAt?: number };

// 백업 파일은 화면에 필요한 기존 Firestore 필드를 그대로 보존합니다.
// 가져올 때 외부 파일의 타입을 검사하고 같은 문서 ID는 기본적으로 덮어쓰지 않습니다.
export type BackupValue = string | number | null;
export type BackupData = Record<string, BackupValue>;
export type BackupRecord = { id: string; data: BackupData };
export type ArchiveBackup = {
  format: "kwons-archive";
  version: 1;
  projectId: string;
  exportedAt: string;
  books: BackupRecord[];
  trash: BackupRecord[];
};
export type RestoreMode = "missing" | "overwrite";

