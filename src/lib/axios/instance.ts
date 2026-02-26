import useSessionStore from "@/store/session-store";
import axios from "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    _internal_meta_sync?: boolean;
    _retry?: boolean;
  }

  export interface InternalAxiosRequestConfig {
    _internal_meta_sync?: boolean;
    _retry?: boolean;
  }
}

export const Api = axios.create({
  withCredentials: true,
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  validateStatus: () => true,
});

Api.interceptors.request.use(async (config) => {
  if (config.url?.startsWith("/products")) {
    if (!config._internal_meta_sync) {
      try {
        await Api.get("/products/meta-obj", {
          _internal_meta_sync: true,
        });
      } catch {
        console.warn("Metaobject sync failed");
      }
    }
  }

  return config;
});

Api.interceptors.response.use(
  async (response) => {
    const config = response.config;

    // validateStatus: () => true means 401s land here instead of the error handler.
    // Skip retry for auth endpoints (refresh, login…) to avoid infinite loops.
    if (
      response.status === 401 &&
      !config._retry &&
      !config.url?.includes("/auth/")
    ) {
      config._retry = true;
      try {
        await Api.post("/auth/refresh-token", undefined, { _retry: true });
        return Api(config);
      } catch {
        useSessionStore.getState().clearSession();
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }
      }
    }

    return response;
  },
  async (error) => {
    // Handles network errors / timeouts (validateStatus bypasses this for HTTP errors)
    const { config, response } = error;
    if (response?.status === 401 && !config?._retry) {
      config._retry = true;
      try {
        await Api.post("/auth/refresh-token", undefined, { _retry: true });
        return Api(config);
      } catch {
        useSessionStore.getState().clearSession();
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }
      }
    }

    return Promise.reject(error);
  },
);

export const handleAxiosError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return {
      message: error.response?.data?.message || "Unknown error",
      status: error.response?.status || 500,
    };
  }
  throw error;
};
