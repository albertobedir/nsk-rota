"use client";

import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
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
  const router = useRouter(); // ← EKLENDİ

  const { searchProducts } = useProductsStore();

  // --- ARAMA BUTONU ---
  const handleSearch = async () => {
    if (type === "single") {
      if (!value.trim()) return;

      await searchProducts(value.trim()); // ✔️ string gider
      setValue("");
      router.push(`/products`);
    } else {
      if (tags.length === 0) return;

      const query = tags.map((t) => t.value).join(","); // ✔ string haline getir

      router.push(`/products`);
      await searchProducts(query); // ✔ string gönder
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (type === "single") {
      handleSearch();
    } else {
      if (value.trim() !== "") {
        setTags([...tags, { id: uuid(), value, editable: false }]);
        setValue("");
      }
    }
  };

  const removeTag = (tag: Tag) => {
    setTags(tags.filter((t) => t.id !== tag.id));
  };

  const handleDoubleClick = (tag: Tag) => {
    setTags(
      tags.map((t) =>
        t.id === tag.id ? { ...t, editable: true } : { ...t, editable: false }
      )
    );
  };

  const handleChangeTagValue = (tag: Tag, value: string) => {
    setTags(
      tags.map((t) => ({ ...t, value: t.id === tag.id ? value : t.value }))
    );
  };

  const placeholder = useMemo(() => {
    return type === "single"
      ? "OEM veya ROTA No ile arayın."
      : "Çoklu OEM Kodu ve ROTA Kodu ile arayın.";
  }, [type]);

  return (
    <div className="shadow-[0px_0px_20px_0px_#000] shadow-muted-foreground/30 rounded-xl w-full sm:flex-row flex flex-col sm:items-start">
      {/* SOL BUTONLAR */}
      <div className="flex sm:grid sm:grid-rows-2 sm:-mr-5 sm:pr-2 relative z-0 bg-[#e8e8e8] rounded-l-xl sm:h-18 h-13 overflow-hidden">
        <button
          className={cn(
            "h-full w-full flex sm:pl-0 items-center gap-2 sm:px-4 pr-8 py-1 rounded-none cursor-pointer font-semibold pl-5",
            type === "single" ? "bg-secondary text-white" : ""
          )}
          onClick={() => setType("single")}
        >
          <Icons name="single-search" width={28} height={28} />
          <span className="text-[0.7rem]">Tekil Arama</span>
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
            type === "multiple" ? "bg-secondary text-white" : ""
          )}
          onClick={() => setType("multiple")}
        >
          <Icons name="multiple-search" width={28} height={28} />
          <span className="text-[0.7rem]">Çoklu Arama</span>
          <Icons
            name="chevron-right"
            width={10}
            height={28}
            className="ml-auto"
          />
        </button>
      </div>

      {/* INPUT + BUTTON */}
      <div className="flex-1 relative z-10 bg-white rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center pr-6 sm:h-18 h-13">
          <form className="flex-1" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder={placeholder}
              name="search"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-5 text-lg outline-none placeholder:text-xl h-18"
            />
          </form>

          <button
            onClick={handleSearch}
            className="p-2.5 bg-secondary rounded-full cursor-pointer"
          >
            <Icons
              className="text-white"
              width={20}
              height={20}
              name="search"
            />
          </button>
        </div>

        {/* TAGS */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto px-5 py-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="bg-[#ddd] text-black rounded-lg pl-2 pr-1 py-0.5"
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
        )}
      </div>
    </div>
  );
}
