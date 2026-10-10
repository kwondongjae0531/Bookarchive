"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDocs, runTransaction, updateDoc,
} from "firebase/firestore";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User,
} from "firebase/auth";
import { db } from "../app/firebase";
import type {
  Book, BookForm, TrashBook, SortBy, ArchiveBackup, BackupRecord, RestoreMode,
} from "../lib/archive/types";
import { FALLBACK_COVER, todayString, emptyForm } from "../lib/archive/utils";
import {
  BACKUP_MAX_FILE_BYTES, normalizeBackupData, parseArchiveBackup,
} from "../lib/archive/backup";

/**
 * 기존 상태 관리·Firebase 저장/복원 핸들러를 동작 변경 없이 이동한 훅.
 * 데이터 구조나 Firestore 컬렉션명(books/trash)은 변경하지 않습니다.
 */
export function useArchiveController() {
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
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [backupNotice, setBackupNotice] = useState("");
  const [restorePreview, setRestorePreview] = useState<ArchiveBackup | null>(null);
  const [restoreFileName, setRestoreFileName] = useState("");
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("missing");
  const backupFileRef = useRef<HTMLInputElement>(null);
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
          setIsBackupOpen(false);
          setRestorePreview(null);
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
      setIsBackupOpen(false);
      setRestorePreview(null);
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

  function openBackup() {
    if (!isAdmin) return;
    setSelectedBookId(null);
    setIsTrashOpen(false);
    setIsBackupOpen(true);
    setBackupError("");
    setBackupNotice("");
  }

  function closeBackup() {
    if (backupBusy) return;
    setIsBackupOpen(false);
    setRestorePreview(null);
    setRestoreFileName("");
    setRestoreMode("missing");
    setBackupError("");
    setBackupNotice("");
    if (backupFileRef.current) backupFileRef.current.value = "";
  }

  async function downloadArchiveBackup() {
    if (!isAdmin || backupBusy) return;
    setBackupBusy(true);
    setBackupError("");
    setBackupNotice("");
    try {
      // 휴지통은 관리자 보안 규칙으로 보호되고, 다운로드도 관리자에게만 노출됩니다.
      const [booksSnapshot, trashSnapshot] = await Promise.all([
        getDocs(collection(db, "books")),
        getDocs(collection(db, "trash")),
      ]);
      const payload: ArchiveBackup = {
        format: "kwons-archive",
        version: 1,
        projectId: db.app.options.projectId || "",
        exportedAt: new Date().toISOString(),
        books: booksSnapshot.docs.map((entry) => ({
          id: entry.id, data: normalizeBackupData(entry.data(), "books"),
        })),
        trash: trashSnapshot.docs.map((entry) => ({
          id: entry.id, data: normalizeBackupData(entry.data(), "trash"),
        })),
      };
      const validatedPayload = parseArchiveBackup(payload, payload.projectId);
      const content = JSON.stringify(validatedPayload, null, 2);
      const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `kwons-archive-backup-${todayString()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setBackupNotice(`백업 파일 생성 완료: 책 ${payload.books.length}권 · 휴지통 ${payload.trash.length}권. 안전한 곳에 보관해 주세요.`);
    } catch (err) {
      console.error("백업 생성 오류:", err);
      setBackupError("백업 생성에 실패했어요. 관리자 로그인과 Firebase 읽기 권한을 확인해주세요.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function loadBackupFile(file: File | undefined) {
    setRestorePreview(null);
    setRestoreFileName("");
    setBackupNotice("");
    setBackupError("");
    if (!file) return;
    if (file.size > BACKUP_MAX_FILE_BYTES) {
      setBackupError("백업 파일은 10MB 이하만 불러올 수 있어요.");
      return;
    }
    setBackupBusy(true);
    try {
      const raw: unknown = JSON.parse(await file.text());
      const parsed = parseArchiveBackup(raw, db.app.options.projectId || "");
      setRestorePreview(parsed);
      setRestoreFileName(file.name);
      setRestoreMode("missing");
      setBackupNotice(`파일 확인 완료: 책 ${parsed.books.length}권 · 휴지통 ${parsed.trash.length}권. 아직 Firebase에는 아무것도 변경되지 않았어요.`);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : "백업 파일을 읽을 수 없어요.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function restoreArchiveBackup() {
    if (!isAdmin || backupBusy || !restorePreview) return;
    const overwrite = restoreMode === "overwrite";
    const description = overwrite
      ? "동일한 ID의 현재 책/휴지통 기록을 백업 내용으로 덮어씁니다. 다른 책은 삭제하지 않아요."
      : "현재 없는 책/휴지통 기록만 추가합니다. 기존 기록은 절대 덮어쓰지 않아요.";
    if (!window.confirm(`백업 파일을 Firebase에 복원할까요?\n${description}`)) return;
    if (overwrite && window.prompt("기존 기록을 덮어쓰려면 '덮어쓰기'를 입력해주세요.") !== "덮어쓰기") return;
    setBackupBusy(true);
    setBackupError("");
    setBackupNotice("");
    let added = 0;
    let replaced = 0;
    let skipped = 0;
    let conflicts = 0;
    const jobs: Array<{ source: "books" | "trash"; record: BackupRecord }> = [
      ...restorePreview.books.map((record) => ({ source: "books" as const, record })),
      ...restorePreview.trash.map((record) => ({ source: "trash" as const, record })),
    ];
    try {
      // 각 묶음은 트랜잭션: 읽기 → 쓰기 순서로 처리합니다.
      // 중단되어도 이미 들어간 항목을 다시 덮어쓰지 않고 재시도할 수 있습니다.
      for (let offset = 0; offset < jobs.length; offset += 100) {
        const chunk = jobs.slice(offset, offset + 100);
        const count = await runTransaction(db, async (transaction) => {
          const refs = chunk.map(({ source, record }) => doc(db, source, record.id));
          const oppositeRefs = chunk.map(({ source, record }) => doc(db, source === "books" ? "trash" : "books", record.id));
          // 모든 읽기를 먼저 수행하여 transaction.set보다 늦게 transaction.get이 실행되지 않도록 합니다.
          const [snapshots, oppositeSnapshots] = await Promise.all([
            Promise.all(refs.map((ref) => transaction.get(ref))),
            Promise.all(oppositeRefs.map((ref) => transaction.get(ref))),
          ]);
          let inserted = 0;
          let updated = 0;
          let unchanged = 0;
          let blocked = 0;
          snapshots.forEach((snapshot, index) => {
            // 반대쪽 컬렉션에 같은 책이 존재하면 이중 등록을 만들지 않습니다.
            if (oppositeSnapshots[index].exists()) {
              blocked++;
              return;
            }
            if (snapshot.exists() && !overwrite) {
              unchanged++;
              return;
            }
            transaction.set(refs[index], chunk[index].record.data);
            if (snapshot.exists()) updated++; else inserted++;
          });
          return { inserted, updated, unchanged, blocked };
        });
        added += count.inserted;
        replaced += count.updated;
        skipped += count.unchanged;
        conflicts += count.blocked;
        setBackupNotice(`복원 진행 중: ${Math.min(offset + chunk.length, jobs.length)} / ${jobs.length}건 처리`);
      }
      await Promise.all([fetchBooks(), fetchTrash()]);
      setBackupNotice(`복원 완료: 새로 추가 ${added}건 · 덮어쓰기 ${replaced}건 · 기존 유지 ${skipped}건 · 책장/휴지통 충돌로 보류 ${conflicts}건.${conflicts ? " 충돌한 책은 TRASH에서 확인한 뒤 직접 복원해주세요." : ""}`);
      setRestorePreview(null);
      setRestoreFileName("");
      if (backupFileRef.current) backupFileRef.current.value = "";
    } catch (err) {
      console.error("백업 복원 오류:", err);
      setBackupError(`복원이 중단됐어요. 이전 묶음에서 ${added + replaced}건이 저장됐을 수 있어요. 같은 파일로 다시 시도할 수 있습니다. ${err instanceof Error ? err.message : ""}`);
    } finally {
      setBackupBusy(false);
    }
  }

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isFormOpen && !selectedBookId && !isTrashOpen && !isBackupOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving && !trashBusyId && !backupBusy) {
        setIsFormOpen(false);
        setSelectedBookId(null);
        setEditingBookId(null);
        setIsTrashOpen(false);
        setIsBackupOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFormOpen, selectedBookId, isTrashOpen, isBackupOpen, isSaving, trashBusyId, backupBusy]);

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
    const movedAt = Date.now(); // 트랜잭션 재시도 시에도 동일한 이동 시각 사용
    try {
      await runTransaction(db, async (transaction) => {
        const bookRef = doc(db, "books", book.id);
        const trashRef = doc(db, "trash", book.id);
        const [bookSnap, trashSnap] = await Promise.all([
          transaction.get(bookRef), transaction.get(trashRef),
        ]);
        if (!bookSnap.exists()) throw new Error("이미 삭제되었거나 존재하지 않는 책이에요.");
        if (trashSnap.exists()) throw new Error("휴지통에 같은 ID의 책이 이미 존재해요.");
        transaction.set(trashRef, { ...bookSnap.data(), trashedAt: movedAt });
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

  return {
    books, isLoading, isSaving, error, sortBy,
    setSortBy, isSearchOpen, setIsSearchOpen, searchQuery, setSearchQuery,
    searchInputRef, prefersReducedMotion, isFormOpen, editingBookId, selectionSource,
    form, setForm, authUser, authReady, authBusy,
    authError, trashedBooks, isTrashOpen, isTrashLoading, trashError,
    trashBusyId, isBackupOpen, backupBusy, backupError, backupNotice,
    restorePreview, restoreFileName, restoreMode, setRestoreMode, backupFileRef,
    adminUid, isAdmin, sortedBooks, filteredBooks, selectedBook,
    completedCount, readingCount, handleLogin, handleLogout, fetchBooks,
    fetchTrash, openTrash, openBackup, closeBackup, downloadArchiveBackup,
    loadBackupFile, restoreArchiveBackup, closeSearch, selectBook, closeForm,
    openAddForm, openEditForm, handleSubmit, handleDeleteBook, handleRestoreBook,
    handleDeleteForever, setSelectedBookId, setIsTrashOpen,
  };
}
