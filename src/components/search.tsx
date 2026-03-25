"use client";

import { cn } from "@/lib/utils";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { v1 as uuid } from "uuid";
import Icons from "./icons";
import { useProductsStore } from "@/store/products-store";
import { useRouter } from "next/navigation";

interface Tag {
  id: string;
  value: string;
  editable: boolean;
}

export default function Search() {
  const [type, setType] = useState<"single" | "multiple">("single");
  const [value, setValue] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [shakingTagId, setShakingTagId] = useState<string | null>(null);
  const router = useRouter();

  const { searchProducts } = useProductsStore();

  // Debounce timer ve last search query'i track et
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSearchRef = useRef<string>("");

  const handleSetType = (t: "single" | "multiple") => {
    setType(t);
    if (t === "single") {
      setTags([]);
    }
  };

  // --- SEARCH BUTTON ---
  const handleSearch = useCallback(async () => {
    // Prevent duplicate searches while one is in progress
    if (isSearching) return;

    // Clear any pending debounce
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    if (type === "single") {
      const val = value.trim();
      if (val.length < 4) return; // require min 4 chars

      // Prevent duplicate searches for same query
      if (lastSearchRef.current === val) return;

      lastSearchRef.current = val;
      setIsSearching(true);

      try {
        await searchProducts(val);
        setValue("");
        router.push(`/products`);
      } finally {
        setIsSearching(false);
      }
    } else {
      if (tags.length === 0) return;

      const query = tags.map((t) => t.value).join(",");

      // Prevent duplicate searches for same query
      if (lastSearchRef.current === query) return;

      lastSearchRef.current = query;
      setIsSearching(true);

      try {
        router.push(`/products`);
        await searchProducts(query);
      } finally {
        setIsSearching(false);
      }
    }
  }, [type, value, tags, isSearching, searchProducts, router]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Debounce search submissions
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (type === "single") {
        handleSearch();
      } else {
        if (value.trim() !== "") {
          // Max 20 tags - don't add more
          if (tags.length >= 20) {
            return;
          }

          const parts = value
            .split(/[\s,]+/)
            .map((v) => v.trim())
            .filter(Boolean);

          // Get existing tag values for duplicate check
          const existingValues = new Set(
            tags.map((t) => t.value.toLowerCase()),
          );

          // Filter out duplicates and limit total to 20
          const newTags = parts
            .filter((v) => !existingValues.has(v.toLowerCase()))
            .slice(0, Math.max(0, 20 - tags.length))
            .map((v) => ({
              id: uuid(),
              value: v,
              editable: false,
            }));

          // Check if there are duplicates to shake
          const hasDuplicates = parts.some((v) =>
            existingValues.has(v.toLowerCase()),
          );

          if (hasDuplicates) {
            // Find first duplicate and shake it
            const firstDuplicateValue = parts.find((v) =>
              existingValues.has(v.toLowerCase()),
            );
            const duplicateTag = tags.find(
              (t) =>
                t.value.toLowerCase() === firstDuplicateValue?.toLowerCase(),
            );
            if (duplicateTag) {
              setShakingTagId(duplicateTag.id);
              setTimeout(() => setShakingTagId(null), 600);
            }
          }

          if (newTags.length > 0) {
            setTags([...tags, ...newTags]);
            setValue("");
          }
        }
      }
    }, 300); // Debounce 300ms
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const removeTag = (tag: Tag) => {
    setTags(tags.filter((t) => t.id !== tag.id));
  };

  const handleDoubleClick = (tag: Tag) => {
    setTags(
      tags.map((t) =>
        t.id === tag.id ? { ...t, editable: true } : { ...t, editable: false },
      ),
    );
  };

  const handleChangeTagValue = (tag: Tag, value: string) => {
    // Check if new value already exists in other tags
    const isDuplicate = tags.some(
      (t) => t.id !== tag.id && t.value.toLowerCase() === value.toLowerCase(),
    );

    if (isDuplicate) {
      return; // Don't allow editing to duplicate value
    }

    setTags(
      tags.map((t) => ({ ...t, value: t.id === tag.id ? value : t.value })),
    );
  };

  const placeholder = useMemo(() => {
    return type === "single"
      ? "Search by OEM or ROTA No."
      : "Search by multiple OEM and ROTA codes.";
  }, [type]);

  return (
    <div className="w-full flex flex-col gap-3">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .shake-animation {
          animation: shake 0.6s ease-in-out;
        }
      `}</style>
      {/* SEARCH BAR */}
      <div className="shadow-[0px_0px_20px_0px_#000] shadow-muted-foreground/30 rounded-xl w-full sm:flex-row flex flex-col sm:items-start">
        {/* LEFT BUTTONS */}
        <div className="flex sm:grid sm:grid-rows-2 sm:-mr-3 sm:pr-2 relative z-0 bg-[#e8e8e8] rounded-l-xl sm:h-[72px] h-10 overflow-hidden">
          <button
            className={cn(
              "h-full w-full flex sm:pl-0 items-center gap-2 sm:px-4 pr-8 py-1 rounded-none cursor-pointer font-semibold pl-5",
              type === "single" ? "bg-secondary text-white" : "",
            )}
            onClick={() => handleSetType("single")}
          >
            <Icons name="single-search" width={28} height={28} />
            <span className="sm:text-[1rem] text-[0.8rem] sm:font-bold">
              Single Search
            </span>
            <Icons
              name="chevron-right"
              width={10}
              height={28}
              className="ml-auto"
            />
          </button>

          <button
            className={cn(
              "h-full w-full pl-5 sm:pl-0 flex items-center gap-2 sm:px-4 pr-8 py-1 rounded-none cursor-pointer font-semibold",
              type === "multiple" ? "bg-secondary text-white" : "",
            )}
            onClick={() => handleSetType("multiple")}
          >
            <Icons name="multiple-search" width={28} height={28} />
            <span className="sm:text-[1rem] text-[0.7rem] sm:font-bold">
              Multiple Search
            </span>
            <Icons
              name="chevron-right"
              width={10}
              height={28}
              className="ml-auto"
            />
          </button>
        </div>

        {/* INPUT + BUTTON */}
        <div className="flex-1 relative z-10 bg-white rounded-xl overflow-hidden">
          <div className="flex items-center pr-6 sm:h-18 h-13">
            <form className="flex-1" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder={placeholder}
                name="search"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onPaste={(e) => {
                  if (type !== "multiple") return;
                  // Max 20 tags check
                  if (tags.length >= 20) {
                    e.preventDefault();
                    return;
                  }

                  const pasted = e.clipboardData.getData("text");
                  const parts = pasted
                    .split(/[\s,]+/)
                    .map((v) => v.trim())
                    .filter(Boolean);
                  if (parts.length === 0) return;

                  // Get existing tag values for duplicate check
                  const existingValues = new Set(
                    tags.map((t) => t.value.toLowerCase()),
                  );

                  // Filter out duplicates and limit total to 20
                  const newTags = parts
                    .filter((v) => !existingValues.has(v.toLowerCase()))
                    .slice(0, Math.max(0, 20 - tags.length))
                    .map((v) => ({
                      id: uuid(),
                      value: v,
                      editable: false,
                    }));

                  // Check if there are duplicates to shake
                  const hasDuplicates = parts.some((v) =>
                    existingValues.has(v.toLowerCase()),
                  );

                  if (hasDuplicates) {
                    // Find first duplicate and shake it
                    const firstDuplicateValue = parts.find((v) =>
                      existingValues.has(v.toLowerCase()),
                    );
                    const duplicateTag = tags.find(
                      (t) =>
                        t.value.toLowerCase() ===
                        firstDuplicateValue?.toLowerCase(),
                    );
                    if (duplicateTag) {
                      setShakingTagId(duplicateTag.id);
                      setTimeout(() => setShakingTagId(null), 600);
                    }
                  }

                  if (newTags.length > 0) {
                    e.preventDefault();
                    setTags((prev) => [...prev, ...newTags]);
                    setValue("");
                  }
                }}
                className="w-full px-5 text-lg outline-none placeholder:text-lg h-12"
              />
            </form>

            <button
              onClick={handleSearch}
              disabled={
                isSearching || (type === "single" && value.trim().length < 4)
              }
              className={cn(
                "p-2 bg-secondary rounded-full transition-opacity",
                isSearching || (type === "single" && value.trim().length < 4)
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:opacity-90",
              )}
              aria-disabled={
                isSearching || (type === "single" && value.trim().length < 4)
              }
              title={isSearching ? "Aranıyor..." : "Ara"}
            >
              {isSearching ? (
                <div className="animate-spin">
                  <Icons
                    className="text-white"
                    width={20}
                    height={20}
                    name="search"
                  />
                </div>
              ) : (
                <Icons
                  className="text-white"
                  width={20}
                  height={20}
                  name="search"
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* TAGS — rendered below the search bar */}
      {tags.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center px-2 sm:pl-[13rem]">
            <span className="text-xs text-slate-500">
              {tags.length}/20 tags
            </span>
            {tags.length >= 20 && (
              <span className="text-xs text-red-500 font-medium">
                Maximum tags reached
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 px-2 sm:pl-[13rem] bg-white sm:bg-transparent max-h-32 overflow-y-auto">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className={cn(
                  "rounded-lg pl-2 pr-1 py-0.5 shrink-0 transition-colors",
                  shakingTagId === tag.id
                    ? "shake-animation bg-red-100"
                    : "bg-[#ddd] text-black",
                )}
              >
                <input
                  type="text"
                  disabled={!tag.editable}
                  value={tag.value}
                  onChange={(e) => handleChangeTagValue(tag, e.target.value)}
                  onDoubleClick={() => handleDoubleClick(tag)}
                  className="outline-none bg-transparent px-0 py-0"
                  style={{
                    width: `${tag.value.length || 1}ch`,
                    minWidth: "2ch",
                    maxWidth: "100%",
                  }}
                />
                <button
                  className="cursor-pointer hover:bg-red-500/20 rounded-full p-1"
                  onClick={() => removeTag(tag)}
                >
                  <Icons name="x" width={10} height={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
