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
    // Skip retry for:
    // 1. Auth endpoints (refresh, login…) to avoid infinite loops
    // 2. Internal meta sync requests (_internal_meta_sync: true)
    // 3. Request already retried (_retry: true)
    if (
      response.status === 401 &&
      !config._retry &&
      !config._internal_meta_sync &&
      !config.url?.includes("/auth/")
    ) {
      config._retry = true;
      try {
        await Api.post("/auth/refresh", undefined, { _retry: true });
        return Api(config);
      } catch (refreshError) {
        // Refresh failed: clear session and redirect to login
        useSessionStore.getState().clearSession();
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return response;
  },
  async (error) => {
    // Handles network errors / timeouts (validateStatus bypasses this for HTTP errors)
    const { config, response } = error;

    if (
      response?.status === 401 &&
      !config?._retry &&
      !config?._internal_meta_sync &&
      !config?.url?.includes("/auth/")
    ) {
      config._retry = true;
      try {
        await Api.post("/auth/refresh", undefined, { _retry: true });
        return Api(config);
      } catch (refreshError) {
        // Refresh failed: clear session and redirect to login
        useSessionStore.getState().clearSession();
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }
        return Promise.reject(refreshError);
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
