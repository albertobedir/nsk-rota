"use client";

import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import { v1 as uuid } from "uuid";
import Icons from "./icons";

interface Tag {
   id: string;
   value: string;
   editable: boolean;
}

export default function Search() {
   const [type, setType] = useState<"single" | "multiple">("single");
   const [value, setValue] = useState("");
   const [tags, setTags] = useState<Tag[]>([]);

   const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (type === "single") {
         console.log(value);
      } else {
         if (value.trim() !== "") {
            setTags([
               ...new Set([...tags, { id: uuid(), value, editable: false }]),
            ]);
            setValue("");
         }
      }
   };

   const removeTag = (tag: Tag) => {
      setTags(tags.filter((t) => t.id !== tag.id));
   };

   const handleDoubleClick = (tag: Tag) => {
      console.log(tag);
      setTags(
         tags.map((t) =>
            t.id === tag.id
               ? { ...t, editable: false }
               : { ...t, editable: true }
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
      <div className="shadow-[0px_0px_20px_0px_#000] shadow-muted-foreground/30 rounded-xl flex">
         <div className="grid grid-rows-2 -mr-5 relative z-0 bg-[#e8e8e8] rounded-xl h-18">
            <button
               className={cn(
                  "h-full w-full flex items-center gap-2 px-4 pr-8 py-1 rounded-xl cursor-pointer font-bold rounded-bl-none",
                  type === "single" ? "bg-secondary text-white" : ""
               )}
               onClick={() => setType("single")}
            >
               <Icons name="single-search" width={28} height={28} />
               <span>Tekil Arama</span>
               <Icons
                  name="chevron-right"
                  width={10}
                  height={28}
                  className="ml-auto"
               />
            </button>
            <button
               className={cn(
                  "h-full w-full flex items-center gap-2 px-4 pr-8 py-1 rounded-xl cursor-pointer font-bold rounded-tl-none",
                  type === "multiple" ? "bg-secondary text-white" : ""
               )}
               onClick={() => setType("multiple")}
            >
               <Icons name="multiple-search" width={28} height={28} />
               <span>Çoklu Arama</span>
               <Icons
                  name="chevron-right"
                  width={10}
                  height={28}
                  className="ml-auto"
               />
            </button>
         </div>
         <div className="flex-1 h-full relative z-10 bg-white rounded-xl">
            <div className="flex items-center pr-6 h-full">
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
               <button className="p-2.5 bg-secondary rounded-full cursor-pointer">
                  <Icons
                     className="text-white"
                     width={20}
                     height={20}
                     name="search"
                  />
               </button>
            </div>
            {tags.length > 0 && (
               <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto p-2">
                  {tags.map((tag) => (
                     <div
                        key={tag.id}
                        className="bg-[#ddd] text-black rounded-lg pl-2 pr-1 py-0.5"
                     >
                        <input
                           type="text"
                           disabled={!tag.editable}
                           value={tag.value}
                           onChange={(e) =>
                              handleChangeTagValue(tag, e.target.value)
                           }
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
