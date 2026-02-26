/* eslint-disable react-hooks/static-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import responseJson from "@/static/response.json";

type Tree = Record<string, Record<string, Record<string, string[]>>>;

function sortAlpha(arr: string[]) {
  return [...arr].sort((a, b) => a.localeCompare(b));
}

function getBrands(tree: Tree) {
  return sortAlpha(Object.keys(tree));
}
function getModels(tree: Tree, brand?: string) {
  if (!brand) return [] as string[];
  return sortAlpha(Object.keys(tree[brand] ?? {}));
}
function getTypes(tree: Tree, brand?: string, model?: string) {
  if (!brand) return [] as string[];
  const brandTree = tree[brand] ?? {};
  // If a specific model is selected, return only its types
  if (model && brandTree[model]) {
    return sortAlpha(Object.keys(brandTree[model]));
  }
  // Otherwise return ALL types across all models for this brand
  const all = new Set<string>();
  for (const m of Object.values(brandTree)) {
    for (const t of Object.keys(m)) all.add(t);
  }
  return sortAlpha(Array.from(all));
}
function getDescriptions(
  tree: Tree,
  brand?: string,
  model?: string,
  type?: string,
) {
  if (!brand) return [] as string[];
  const brandTree = tree[brand] ?? {};
  const all = new Set<string>();
  for (const [m, typesObj] of Object.entries(brandTree)) {
    // filter by model if selected
    if (model && m !== model) continue;
    for (const [t, descs] of Object.entries(
      typesObj as Record<string, string[]>,
    )) {
      // filter by type if selected
      if (type && t !== type) continue;
      for (const d of descs) all.add(d);
    }
  }
  return sortAlpha(Array.from(all));
}

export default function BrandModelTypeCombos({
  filters,
  setFilters,
}: {
  filters: { brand: string; model: string; type: string; desc: string };
  setFilters: (fn: (prev: any) => any) => void;
}) {
  const tree = (responseJson as any).tree as Tree;

  React.useEffect(() => {
    const id = "bm-combobox-scrollbar-style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      .bm-combobox-popover [data-slot="command-list"]::-webkit-scrollbar { width: 8px; }
      .bm-combobox-popover [data-slot="command-list"]::-webkit-scrollbar-thumb { background: var(--secondary, #f97316); border-radius: 8px; }
      .bm-combobox-popover [data-slot="command-list"]::-webkit-scrollbar-track { background: transparent; }
      .bm-combobox-popover [data-slot="command-list"] { scrollbar-width: thin; scrollbar-color: var(--secondary, #f97316) transparent; }
    `;
    document.head.appendChild(style);
  }, []);

  const brands = React.useMemo(() => getBrands(tree), [tree]);
  const models = React.useMemo(
    () => getModels(tree, filters.brand || undefined),
    [tree, filters.brand],
  );
  const types = React.useMemo(
    () =>
      getTypes(tree, filters.brand || undefined, filters.model || undefined),
    [tree, filters.brand, filters.model],
  );
  const descs = React.useMemo(
    () =>
      getDescriptions(
        tree,
        filters.brand || undefined,
        filters.model || undefined,
        filters.type || undefined,
      ),
    [tree, filters.brand, filters.model, filters.type],
  );

  const [brandOpen, setBrandOpen] = React.useState(false);
  const [modelOpen, setModelOpen] = React.useState(false);
  const [typeOpen, setTypeOpen] = React.useState(false);
  const [descOpen, setDescOpen] = React.useState(false);

  const onBrandChange = (v: string) =>
    setFilters((p: any) => ({ ...p, brand: v, model: "", type: "", desc: "" }));
  const onModelChange = (v: string) =>
    setFilters((p: any) => ({ ...p, model: v, type: "", desc: "" }));
  const onTypeChange = (v: string) =>
    setFilters((p: any) => ({ ...p, type: v, desc: "" }));

  function ComboboxPopover({
    label,
    options,
    value,
    onChange,
    open,
    setOpen,
    placeholder,
    disabled,
  }: {
    label: string;
    options: string[];
    value: string;
    onChange: (v: string) => void;
    open: boolean;
    setOpen: (v: boolean) => void;
    placeholder: string;
    disabled?: boolean;
  }) {
    const selectedLabel = value || "";

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="cursor-pointer w-[300px]" asChild>
          <Button
            variant="ghost"
            size="default"
            className={cn(
              "w-[300px] justify-between text-muted-foreground h-[52px] bg-[#f3f3f3] text-[16px] p-4 text-left rounded-sm",
            )}
            aria-expanded={open}
            role="combobox"
            disabled={disabled}
          >
            {selectedLabel ? selectedLabel : placeholder}
            <ChevronDown
              className={cn(
                "transition-transform duration-200 transform text-secondary",
                open ? "rotate-180" : "rotate-0",
              )}
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="bm-combobox-popover w-[300px] p-2 [&_[data-slot=command-input-wrapper]_svg]:hidden **:data-[slot=command-input-wrapper]:border-b-0 outline-none border-none shadow-none bg-[#f3f3f3] -mt-2">
          <Command className="bg-[#f3f3f3] p-0 m-0">
            <div className="my-[0.5rem]">
              <CommandInput className="w-full pl-2 text-[1rem] h-full font-semibold bg-[#e8e8e8]" />
            </div>
            <CommandList className="max-h-[220px]">
              <CommandEmpty>No {label} found.</CommandEmpty>
              <CommandGroup>
                {options.filter(Boolean).map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={(currentValue: string) => {
                      onChange(currentValue === value ? "" : currentValue);
                      setOpen(false);
                    }}
                    className="group px-3 py-3 text-[1rem] text-muted-foreground cursor-pointer"
                  >
                    <span
                      className={`truncate ${
                        value === opt ? "font-bold" : "font-medium"
                      } group-hover:text-secondary`}
                    >
                      {opt}
                    </span>
                    <Check
                      className={cn(
                        "ml-auto",
                        value === opt ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
      <div>
        <label className="sr-only">Brand</label>
        <ComboboxPopover
          label="brand"
          options={brands}
          value={filters.brand}
          onChange={(v) => onBrandChange(v)}
          open={brandOpen}
          setOpen={setBrandOpen}
          placeholder="Brand"
        />
      </div>

      <div>
        <label className="sr-only">Model</label>
        <ComboboxPopover
          label="model"
          options={models}
          value={filters.model}
          onChange={(v) => onModelChange(v)}
          open={modelOpen}
          setOpen={setModelOpen}
          placeholder={filters.brand ? "Select model" : "Select brand first"}
          disabled={!filters.brand}
        />
      </div>

      <div>
        <label className="sr-only">Type</label>
        <ComboboxPopover
          label="type"
          options={types}
          value={filters.type}
          onChange={(v) => onTypeChange(v)}
          open={typeOpen}
          setOpen={setTypeOpen}
          placeholder={filters.brand ? "Select type" : "Select brand first"}
          disabled={!filters.brand}
        />
      </div>

      <div>
        <label className="sr-only">Description</label>
        <ComboboxPopover
          label="description"
          options={descs}
          value={filters.desc}
          onChange={(v) => setFilters((p: any) => ({ ...p, desc: v }))}
          open={descOpen}
          setOpen={setDescOpen}
          placeholder={
            filters.brand ? "Select description" : "Select brand first"
          }
          disabled={!filters.brand}
        />
      </div>
    </div>
  );
}
