"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../app/firebase";
import type { ReadingStatus } from "../../lib/archive/types";

export default function ReadingProgressPanel({
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

