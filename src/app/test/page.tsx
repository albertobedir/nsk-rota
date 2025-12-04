"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

export default function Page() {
  const [toggle, setToggle] = useState("single");
  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  const baseClasses =
    "py-1 pl-3 pr-15 flex justify-center items-center cursor-pointer transition-all";

  const activeClasses = "text-white bg-secondary font-semibold ";
  const inactiveClasses = "text-black bg-[#e8e8e8] font-semibold ";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "Enter" &&
      toggle === "multiple" &&
      inputValue.trim() !== ""
    ) {
      setTags([...tags, inputValue.trim()]);
      setInputValue("");
    }
  };

  return (
    <div className="bg-red-400 p-5 flex justify-center items-center">
      <Card className="flex flex-row bg-transparent p-0 gap-0">
        <div className="flex flex-col rounded-[inherit] -mr-7">
          <div
            className={`${baseClasses} rounded-tl-[inherit] ${
              toggle === "single" ? activeClasses : inactiveClasses
            }`}
            onClick={() => setToggle("single")}
          >
            <Search size={20} />
            <span className="text-md ml-1 ">Single Search</span>
          </div>

          <div
            className={`${baseClasses} rounded-bl-[inherit] ${
              toggle === "multiple" ? activeClasses : inactiveClasses
            }`}
            onClick={() => setToggle("multiple")}
          >
            <Search size={20} />
            <span className="text-md ml-1">Multiple Search</span>
          </div>
        </div>

        <div className="flex flex-col flex-1 bg-white rounded-[inherit] p-2">
          <input
            className="bg-white outline-none placeholder:font-medium placeholder:text-muted-foreground placeholder:text-xl w-full pl-2"
            placeholder={
              toggle === "single"
                ? "Search with OEM No or ROTA No"
                : "Search with multiple OEM Code and ROTA Code"
            }
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          {toggle === "multiple" && tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag, index) => (
                <div
                  key={index}
                  className="px-3 py-1 bg-secondary text-white rounded-xl text-sm"
                >
                  {tag}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
