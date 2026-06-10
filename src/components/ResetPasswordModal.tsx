"use client";
import { useState } from "react";
import useSessionStore from "@/store/session-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ResetPasswordModal({
  isOpen,
  onClose,
}: ResetPasswordModalProps) {
  const user = useSessionStore((s) => s.user);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const handleReset = async () => {
    if (!user?.email) {
      toast.error("Unable to retrieve your email. Please try again.");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: user.email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("done");
        setMessage(data.message);
        toast.success("Check your email for reset instructions");
        setTimeout(() => {
          onClose();
          setStatus("idle");
          setMessage("");
        }, 2000);
      } else {
        setStatus("error");
        setMessage(data.message);
        toast.error(data.message);
      }
    } catch (error) {
      setStatus("error");
      setMessage("An error occurred. Please try again.");
      toast.error("An error occurred. Please try again.");
      console.error("Forgot password error:", error);
    }
  };

  const handleClose = () => {
    if (status !== "loading") {
      setStatus("idle");
      setMessage("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            We'll send you a reset link to your email address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="px-3 py-2 bg-slate-100 rounded-md text-sm text-slate-700 border border-slate-200">
              {user?.email ?? "-"}
            </div>
          </div>
        </div>

        {status === "done" ? (
          <div className="rounded-lg bg-green-50 p-4 border border-green-200">
            <p className="text-sm font-medium text-green-800">{message}</p>
            <p className="mt-2 text-xs text-green-700">
              Check your email for a link to reset your password.
            </p>
          </div>
        ) : status === "error" ? (
          <div className="rounded-lg bg-red-50 p-4 border border-red-200">
            <p className="text-sm text-red-700">{message}</p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={status === "loading"}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleReset}
            disabled={status === "loading"}
            className="gap-2"
          >
            {status === "loading" && <Spinner className="h-4 w-4" />}
            {status === "loading"
              ? "Sending..."
              : status === "done"
                ? "Sent"
                : "Send Reset Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
