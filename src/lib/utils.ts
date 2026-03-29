import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validate if an image URL is accessible (HTTP 200-299)
 * @param url - The URL to validate
 * @param timeout - Timeout in milliseconds (default: 5000ms)
 * @returns Promise<boolean> - true if image is accessible, false otherwise
 */
export async function validateImageUrl(
  url: string,
  timeout: number = 5000,
): Promise<boolean> {
  if (!url) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      // Don't follow redirects for invalid URLs
      redirect: "manual",
    });

    clearTimeout(timeoutId);

    // Accept 200-299 status codes
    return response.ok;
  } catch (error) {
    // Network error, timeout, or other fetch error
    return false;
  }
}

/**
 * Validate multiple image URLs in parallel
 * @param urls - Array of URLs to validate
 * @param timeout - Timeout per request in milliseconds (default: 5000ms)
 * @returns Promise<Map<string, boolean>> - Map of URL -> isValid
 */
export async function validateImageUrls(
  urls: string[],
  timeout: number = 5000,
): Promise<Map<string, boolean>> {
  const results = await Promise.all(
    urls.map(async (url) => {
      const isValid = await validateImageUrl(url, timeout);
      return [url, isValid] as const;
    }),
  );

  return new Map(results);
}
