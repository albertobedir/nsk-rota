"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import Image from "next/image";

export default function AddMemberPageClient() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [address1, setAddress1] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [zip, setZip] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    function initFromParams() {
      const e = searchParams.get("email") || "";
      const f = searchParams.get("firstName") || "";
      const l = searchParams.get("lastName") || "";
      const c = searchParams.get("companyName") || "";
      const a = searchParams.get("address1") || "";
      const ci = searchParams.get("city") || "";
      const st = searchParams.get("state") || "";
      const z = searchParams.get("zip") || "";
      setEmail(e);
      setFirstName(f);
      setLastName(l);
      setCompanyName(c);
      setAddress1(a);
      setCity(ci);
      setState(st);
      setZip(z);
      setLoading(false);
    }

    initFromParams();
  }, [searchParams]);

  async function createUserConfirmed() {
    if (
      !email ||
      !firstName ||
      !lastName ||
      !companyName ||
      !address1 ||
      !city ||
      !state ||
      !zip
    ) {
      setMessage(
        "Missing parameter: email, firstName, lastName, companyName, address1, city, state or zip",
      );
      setSuccess(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/add-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          companyName,
          address1,
          city,
          state,
          zip,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "An error occurred");
        setSuccess(false);
      } else {
        setMessage(data.message || "Member created successfully");
        setSuccess(true);
      }
    } catch (e) {
      setMessage("A server error occurred");
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header / breadcrumb like product page */}
      <div className="bg-[#f3f3f3] py-10">
        <div className="w-full max-w-[1540px]  px-6 md:px-27 mx-auto">
          <h1 className="font-bold text-center sm:text-start text-4xl md:text-5xl text-[#1f1f1f]">
            Add Member
          </h1>

          <div className="flex flex-col md:flex-row gap-2 items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-[#1f1f1f] font-semibold">Home</span>
              <span className="opacity-60">/</span>
              <span className="text-[#1f1f1f] font-semibold">Members</span>
              <span className="opacity-60">/</span>
              <span className="text-[#1f1f1f]">Add Member</span>
            </div>
            <Image
              className="sm:-mt-[5rem] mt-5"
              src="/tecdoc.png"
              alt="TecDoc Data Supplier"
              width={180}
              height={52}
              priority
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <section className="flex items-start justify-center py-16 px-6">
        <div className="w-full max-w-2xl">
          <div className="bg-white shadow-lg rounded-lg p-8">
            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <Spinner label="Loading..." />
                <p className="text-sm text-muted-foreground">Please wait</p>
              </div>
            ) : (
              <div className="space-y-6">
                {!email ||
                !firstName ||
                !lastName ||
                !companyName ||
                !address1 ||
                !city ||
                !state ||
                !zip ? (
                  <div className="p-4 rounded-md border bg-rose-50 border-rose-200">
                    <h3 className="text-lg font-medium mb-2">
                      Missing Parameter
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      URL parameters are missing. Please include email,
                      firstName, lastName, companyName, address1, city, state
                      and zip parameters.
                    </p>
                    <div className="mt-4 flex gap-3">
                      <Link
                        href="/"
                        className="px-4 py-2 bg-slate-800 text-white rounded-md"
                      >
                        Home
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-semibold mb-3">
                      New Member Details
                    </h3>
                    <div className="text-sm text-muted-foreground mb-4">
                      <div>
                        <strong>Name:</strong> {firstName} {lastName}
                      </div>
                      <div>
                        <strong>Email:</strong> {email}
                      </div>
                      <div>
                        <strong>Company:</strong> {companyName}
                      </div>
                      <div>
                        <strong>Address:</strong> {address1}, {city}, {state}{" "}
                        {zip}
                      </div>
                    </div>

                    <p className="text-sm mb-4">
                      Do you want to save this user to the system?
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => createUserConfirmed()}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-md"
                      >
                        Yes, Save
                      </button>
                      <button
                        onClick={() => router.push("/")}
                        className="px-4 py-2 bg-white border rounded-md"
                      >
                        Cancel
                      </button>
                    </div>

                    {success !== null && (
                      <div
                        className={`mt-4 w-full p-4 rounded-md border ${success ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}
                      >
                        <h4 className="font-medium">
                          {success ? "Success" : "Error"}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {message}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
