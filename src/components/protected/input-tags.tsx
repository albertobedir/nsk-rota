import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type InputTagsProps = {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
};

export function InputTags({ value, onChange, placeholder }: InputTagsProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = () => {
    if (!inputValue.trim()) return;

    onChange([...value, inputValue.trim()]);
    setInputValue("");
  };

  const removeTag = (index: number) => {
    const newTags = value.filter((_, i) => i !== index);
    onChange(newTags);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="flex flex-wrap gap-2 p-2">
      {/* TAGS */}
      {value.map((tag, index) => (
        <span
          key={index}
          className="bg-primary text-white px-2 py-1 rounded-md flex items-center gap-1"
        >
          {tag}
          <X
            size={14}
            className="cursor-pointer"
            onClick={() => removeTag(index)}
          />
        </span>
      ))}

      {/* INPUT */}
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="border-none outline-none shadow-none"
        placeholder={value.length === 0 ? placeholder : ""}
      />
    </div>
  );
}
