"use client";

import type { Book } from "../../lib/archive/types";
import { FALLBACK_COVER } from "../../lib/archive/utils";

export default function BookCover({
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

